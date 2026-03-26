using System.Security.Cryptography;
using System.Text;
using AgentHabitat.Core.WorldGen.Contracts;

namespace AgentHabitat.Core.WorldGen.Implementation;

public sealed class DeterministicWorldGenerator : IWorldGenerator
{
    public WorldGenerationResult GenerateWorld(string seed, WorldGenerationOptions options)
    {
        var rng = new SeededRng(seed);
        var rooms = PlaceRooms(rng, options).ToList();

        var walkable = new bool[options.Width, options.Height];
        StampRoomsAsWalkable(rooms, walkable, options);
        ConnectRoomsWithCorridors(rooms, walkable, options);

        var doors = GenerateDoors(rng, rooms, walkable, options);

        var topoHash = ComputeTopologyHash(seed, options, rooms, walkable);

        return new WorldGenerationResult(
            options.Width,
            options.Height,
            rooms,
            doors,
            walkable,
            topoHash,
            seed,
            options
        );
    }

    private static IEnumerable<RoomPlacement> PlaceRooms(SeededRng rng, WorldGenerationOptions options)
    {
        var required = new[]
        {
            RoomArchetype.CodingRoom,
            RoomArchetype.ReviewRoom,
            RoomArchetype.Library,
            RoomArchetype.Lounge
        };

        var rooms = new List<RoomPlacement>();
        var id = 1;

        foreach (var archetype in required)
        {
            var w = rng.Next(8, 14);
            var h = rng.Next(6, 11);

            RoomPlacement placed;
            var tries = 0;
            do
            {
                var x = rng.Next(1, options.Width - w - 1);
                var y = rng.Next(1, options.Height - h - 1);
                placed = new RoomPlacement($"room-{id}", archetype, x, y, w, h);
                tries++;
                if (tries > 300)
                {
                    throw new InvalidOperationException("Unable to place required rooms without overlap.");
                }
            }
            while (rooms.Any(r => Overlap(r, placed)));

            rooms.Add(placed);
            id++;
        }

        return rooms;
    }

    private static void StampRoomsAsWalkable(IEnumerable<RoomPlacement> rooms, bool[,] walkable, WorldGenerationOptions options)
    {
        foreach (var room in rooms)
        {
            for (var x = room.X; x < room.X + room.Width; x++)
            {
                for (var y = room.Y; y < room.Y + room.Height; y++)
                {
                    if (x >= 0 && y >= 0 && x < options.Width && y < options.Height)
                    {
                        walkable[x, y] = true;
                    }
                }
            }
        }
    }

    private static void ConnectRoomsWithCorridors(IReadOnlyList<RoomPlacement> rooms, bool[,] walkable, WorldGenerationOptions options)
    {
        for (var i = 1; i < rooms.Count; i++)
        {
            var a = rooms[i - 1];
            var b = rooms[i];

            CarveHorizontal(a.CenterX, b.CenterX, a.CenterY, walkable, options);
            CarveVertical(a.CenterY, b.CenterY, b.CenterX, walkable, options);
        }
    }

    private static void CarveHorizontal(int x1, int x2, int y, bool[,] walkable, WorldGenerationOptions options)
    {
        var min = Math.Min(x1, x2);
        var max = Math.Max(x1, x2);

        for (var x = min; x <= max; x++)
        {
            for (var w = 0; w < options.CorridorWidth; w++)
            {
                var yy = y + w;
                if (x >= 0 && x < options.Width && yy >= 0 && yy < options.Height)
                {
                    walkable[x, yy] = true;
                }
            }
        }
    }

    private static void CarveVertical(int y1, int y2, int x, bool[,] walkable, WorldGenerationOptions options)
    {
        var min = Math.Min(y1, y2);
        var max = Math.Max(y1, y2);

        for (var y = min; y <= max; y++)
        {
            for (var w = 0; w < options.CorridorWidth; w++)
            {
                var xx = x + w;
                if (xx >= 0 && xx < options.Width && y >= 0 && y < options.Height)
                {
                    walkable[xx, y] = true;
                }
            }
        }
    }

    private static List<DoorPlacement> GenerateDoors(
        SeededRng rng,
        IReadOnlyList<RoomPlacement> rooms,
        bool[,] walkable,
        WorldGenerationOptions options)
    {
        var doors = new List<DoorPlacement>();
        var doorId = 1;

        // Track doors per connection pair to enforce cap (max 2 between any two spaces)
        // Key: sorted pair like "room-1|corridor" or "room-1|room-2"
        var pairCounts = new Dictionary<string, int>();
        string PairKey(string a, string? b) {
            var s = b ?? "corridor";
            return string.Compare(a, s, StringComparison.Ordinal) <= 0 ? $"{a}|{s}" : $"{s}|{a}";
        }

        foreach (var room in rooms)
        {
            var candidates = FindDoorCandidates(room, rooms, walkable, options);

            if (candidates.Count == 0)
                throw new InvalidOperationException($"Room {room.Id} has no valid door candidates.");

            // Score and sort candidates for quality placement
            var scored = candidates.Select(c =>
            {
                var (x, y, dir, connectsTo) = c;
                var score = 0;

                // Prefer corridor connections (primary access) over room-to-room
                if (connectsTo == "corridor") score += 10;

                // Prefer wall centers over corners
                var distFromCorner = dir switch
                {
                    DoorDirection.North or DoorDirection.South =>
                        Math.Min(x - room.X, room.X + room.Width - 1 - x),
                    _ => Math.Min(y - room.Y, room.Y + room.Height - 1 - y)
                };
                score += Math.Min(distFromCorner, 3); // up to +3 for being away from corners

                return (Candidate: c, Score: score);
            })
            .OrderByDescending(s => s.Score)
            .Select(s => s.Candidate)
            .ToList();

            // Deterministic shuffle within same-score tiers
            for (var i = scored.Count - 1; i > 0; i--)
            {
                var j = rng.Next(0, i + 1);
                (scored[i], scored[j]) = (scored[j], scored[i]);
            }

            // Re-sort by score after shuffle (stable relative to shuffle within tiers)
            scored = scored
                .Select(c => {
                    var (x, y, dir, connectsTo) = c;
                    var score = (connectsTo == "corridor" ? 10 : 0) +
                        Math.Min(dir is DoorDirection.North or DoorDirection.South
                            ? Math.Min(x - room.X, room.X + room.Width - 1 - x)
                            : Math.Min(y - room.Y, room.Y + room.Height - 1 - y), 3);
                    return (C: c, S: score);
                })
                .OrderByDescending(s => s.S)
                .Select(s => s.C)
                .ToList();

            // Determine door count: 1 base, maybe 2 for larger rooms
            var area = room.Width * room.Height;
            var maxDoors = area > 50 ? 2 : 1;

            var placed = new List<(int X, int Y, DoorDirection Dir, string? ConnectsTo)>();

            foreach (var (x, y, dir, connectsTo) in scored)
            {
                if (placed.Count >= maxDoors) break;

                // Pair cap: max 2 doors between same two spaces
                var pk = PairKey(room.Id, connectsTo);
                var currentPairCount = pairCounts.GetValueOrDefault(pk, 0);
                if (currentPairCount >= 2) continue;

                // Min spacing: doors on same wall must be 3+ tiles apart
                // (unless this would be the first door — always allow)
                if (placed.Count > 0)
                {
                    var tooClose = placed.Any(p =>
                    {
                        if (p.Dir != dir) return false; // different walls, OK
                        var dist = Math.Abs(p.X - x) + Math.Abs(p.Y - y);
                        return dist > 0 && dist < 3; // adjacent (1) or too close (2) — skip
                    });
                    if (tooClose) continue;

                    // Prefer opposite walls for 2nd door (diversity)
                    var oppositeExists = placed.Any(p =>
                        (p.Dir == DoorDirection.North && dir == DoorDirection.South) ||
                        (p.Dir == DoorDirection.South && dir == DoorDirection.North) ||
                        (p.Dir == DoorDirection.East && dir == DoorDirection.West) ||
                        (p.Dir == DoorDirection.West && dir == DoorDirection.East));
                    var sameWall = placed.Any(p => p.Dir == dir);

                    // If we already have a door on same wall, strongly prefer opposite wall
                    if (sameWall && !oppositeExists)
                    {
                        // 80% chance to skip same-wall placement if opposite is available
                        var hasOppCandidate = scored.Any(s =>
                            s.Item3 != dir && !placed.Any(p => p.Dir == s.Item3));
                        if (hasOppCandidate && rng.Next(0, 5) < 4) continue;
                    }
                }

                placed.Add((x, y, dir, connectsTo));
                pairCounts[pk] = currentPairCount + 1;
            }

            // Safety: ensure at least 1 door (should always succeed given candidates exist)
            if (placed.Count == 0)
            {
                var fallback = scored[0];
                placed.Add(fallback);
                var fpk = PairKey(room.Id, fallback.Item4);
                pairCounts[fpk] = pairCounts.GetValueOrDefault(fpk, 0) + 1;
            }

            foreach (var (x, y, dir, connectsTo) in placed)
            {
                doors.Add(new DoorPlacement(
                    $"door-{doorId++}",
                    x, y,
                    room.Id,
                    dir,
                    DoorState.Open,
                    connectsTo
                ));
            }
        }

        return doors;
    }

    private static List<(int X, int Y, DoorDirection Dir, string? ConnectsTo)> FindDoorCandidates(
        RoomPlacement room,
        IReadOnlyList<RoomPlacement> allRooms,
        bool[,] walkable,
        WorldGenerationOptions options)
    {
        var candidates = new List<(int, int, DoorDirection, string?)>();
        var W = options.Width;
        var H = options.Height;

        // Scan each edge of the room perimeter (including corners)
        // North edge (y = room.Y, look at y-1)
        for (var x = room.X; x < room.X + room.Width; x++)
        {
            var oy = room.Y - 1;
            if (oy >= 0 && walkable[x, oy] && !IsInsideRoom(x, oy, room))
            {
                var target = FindConnectsTo(x, oy, room, allRooms);
                candidates.Add((x, room.Y, DoorDirection.North, target));
            }
        }

        // South edge (y = room.Y + room.Height - 1, look at y+1)
        for (var x = room.X; x < room.X + room.Width; x++)
        {
            var oy = room.Y + room.Height;
            if (oy < H && walkable[x, oy] && !IsInsideRoom(x, oy, room))
            {
                var target = FindConnectsTo(x, oy, room, allRooms);
                candidates.Add((x, room.Y + room.Height - 1, DoorDirection.South, target));
            }
        }

        // West edge (x = room.X, look at x-1)
        for (var y = room.Y; y < room.Y + room.Height; y++)
        {
            var ox = room.X - 1;
            if (ox >= 0 && walkable[ox, y] && !IsInsideRoom(ox, y, room))
            {
                var target = FindConnectsTo(ox, y, room, allRooms);
                candidates.Add((room.X, y, DoorDirection.West, target));
            }
        }

        // East edge (x = room.X + room.Width - 1, look at x+1)
        for (var y = room.Y; y < room.Y + room.Height; y++)
        {
            var ox = room.X + room.Width;
            if (ox < W && walkable[ox, y] && !IsInsideRoom(ox, y, room))
            {
                var target = FindConnectsTo(ox, y, room, allRooms);
                candidates.Add((room.X + room.Width - 1, y, DoorDirection.East, target));
            }
        }

        // Deduplicate corner tiles (corners appear on two edges)
        var seen = new HashSet<(int, int)>();
        var deduped = new List<(int, int, DoorDirection, string?)>();
        foreach (var c in candidates)
        {
            if (seen.Add((c.Item1, c.Item2)))
                deduped.Add(c);
        }

        return deduped;
    }

    private static bool IsInsideRoom(int x, int y, RoomPlacement room) =>
        x >= room.X && x < room.X + room.Width &&
        y >= room.Y && y < room.Y + room.Height;

    private static string? FindConnectsTo(int x, int y, RoomPlacement sourceRoom, IReadOnlyList<RoomPlacement> rooms)
    {
        foreach (var r in rooms)
        {
            if (r.Id == sourceRoom.Id) continue;
            if (x >= r.X && x < r.X + r.Width && y >= r.Y && y < r.Y + r.Height)
                return r.Id;
        }
        return "corridor";
    }

    private static string ComputeTopologyHash(string seed, WorldGenerationOptions options, IEnumerable<RoomPlacement> rooms, bool[,] walkable)
    {
        var sb = new StringBuilder();
        sb.Append(seed).Append('|').Append(options.Width).Append('x').Append(options.Height).Append('|').Append(options.StyleProfile).Append('|').Append(options.ContentPackVersion);

        foreach (var room in rooms.OrderBy(r => r.Id))
        {
            sb.Append('|').Append(room.Id).Append(':').Append(room.Archetype).Append('@').Append(room.X).Append(',').Append(room.Y).Append(',').Append(room.Width).Append('x').Append(room.Height);
        }

        var width = walkable.GetLength(0);
        var height = walkable.GetLength(1);
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                sb.Append(walkable[x, y] ? '1' : '0');
            }
        }

        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool Overlap(RoomPlacement a, RoomPlacement b)
    {
        return a.X < b.X + b.Width &&
               a.X + a.Width > b.X &&
               a.Y < b.Y + b.Height &&
               a.Y + a.Height > b.Y;
    }
}

internal sealed class SeededRng
{
    private ulong _state;

    public SeededRng(string seed)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        _state = BitConverter.ToUInt64(bytes, 0);
        if (_state == 0) _state = 0x9E3779B97F4A7C15UL;
    }

    private ulong NextU64()
    {
        // xorshift64*
        _state ^= _state >> 12;
        _state ^= _state << 25;
        _state ^= _state >> 27;
        return _state * 2685821657736338717UL;
    }

    public int Next(int minInclusive, int maxExclusive)
    {
        var span = (uint)(maxExclusive - minInclusive);
        if (span == 0) return minInclusive;
        return minInclusive + (int)(NextU64() % span);
    }
}
