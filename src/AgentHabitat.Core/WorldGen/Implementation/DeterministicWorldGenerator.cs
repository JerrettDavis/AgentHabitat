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

        // Generate private offices for each agent
        var agents = options.Agents ?? [];
        var officeId = rooms.Count + 1;
        foreach (var agent in agents)
        {
            var office = PlacePrivateOffice(rng, rooms, options, officeId, agent);
            if (office != null)
            {
                rooms.Add(office);
                officeId++;
            }
        }

        var walkable = new bool[options.Width, options.Height];
        StampRoomsAsWalkable(rooms, walkable, options);
        ConnectRoomsWithCorridors(rooms, walkable, options);

        // Also connect offices to nearest shared room via corridors
        var sharedRooms = rooms.Where(r => r.Archetype != RoomArchetype.PrivateOffice).ToList();
        foreach (var office in rooms.Where(r => r.Archetype == RoomArchetype.PrivateOffice))
        {
            var nearest = sharedRooms
                .OrderBy(r => Math.Abs(r.CenterX - office.CenterX) + Math.Abs(r.CenterY - office.CenterY))
                .First();
            CarveHorizontal(office.CenterX, nearest.CenterX, office.CenterY, walkable, options);
            CarveVertical(office.CenterY, nearest.CenterY, nearest.CenterX, walkable, options);
        }

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

    private static RoomPlacement? PlacePrivateOffice(
        SeededRng rng,
        IReadOnlyList<RoomPlacement> existingRooms,
        WorldGenerationOptions options,
        int id,
        AgentDefinition agent)
    {
        // Private offices are smaller: 5-7 wide, 4-6 tall
        var w = rng.Next(5, 8);
        var h = rng.Next(4, 7);

        for (var tries = 0; tries < 300; tries++)
        {
            var x = rng.Next(1, options.Width - w - 1);
            var y = rng.Next(1, options.Height - h - 1);
            var candidate = new RoomPlacement($"office-{agent.Id}", RoomArchetype.PrivateOffice, x, y, w, h);

            var overlaps = existingRooms.Any(r => Overlap(r, candidate));
            if (!overlaps)
                return candidate;
        }

        return null; // Could not place — caller should expand world and retry
    }

    // Capacity expansion: determine minimum world size to fit N offices + shared rooms
    public static (int Width, int Height) ComputeRequiredSize(int sharedRoomCount, int officeCount, int baseWidth = 32, int baseHeight = 24)
    {
        // Each office needs ~35 tiles (5x7) + corridor space (~10 tiles)
        // Shared rooms need ~80 tiles (10x8) each + corridor space
        var totalArea = sharedRoomCount * 120 + officeCount * 60;
        // Target ~40% fill ratio for comfortable placement
        var requiredArea = (int)(totalArea / 0.4);
        var side = (int)Math.Ceiling(Math.Sqrt(requiredArea));
        var width = Math.Max(baseWidth, Math.Min(96, side));
        var height = Math.Max(baseHeight, Math.Min(72, (int)(side * 0.75)));
        return (width, height);
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
        var doorPositions = new HashSet<(int, int)>();

        // PHASE 1: Mandatory doors at every corridor-room junction
        // This ensures every hallway connecting to a room has a door
        foreach (var room in rooms)
        {
            var candidates = FindDoorCandidates(room, rooms, walkable, options);

            // Find all corridor junctions — these MUST get doors
            var corridorJunctions = candidates
                .Where(c => c.Item4 == "corridor")
                .ToList();

            // Group corridor junctions by wall segment to avoid excessive doors on same entry
            // Pick one representative per contiguous corridor entry
            var junctionsByWall = corridorJunctions
                .GroupBy(c => c.Item3) // group by direction (wall)
                .ToList();

            foreach (var wallGroup in junctionsByWall)
            {
                // Find contiguous runs on this wall and pick the center of each run
                var sorted = wallGroup.OrderBy(c => c.Item3 is DoorDirection.North or DoorDirection.South
                    ? c.Item1 : c.Item2).ToList();

                var runs = new List<List<(int, int, DoorDirection, string?)>>();
                var currentRun = new List<(int, int, DoorDirection, string?)> { sorted[0] };

                for (var i = 1; i < sorted.Count; i++)
                {
                    var prev = sorted[i - 1];
                    var curr = sorted[i];
                    var dist = Math.Abs(curr.Item1 - prev.Item1) + Math.Abs(curr.Item2 - prev.Item2);
                    if (dist <= 1)
                        currentRun.Add(curr);
                    else
                    {
                        runs.Add(currentRun);
                        currentRun = [curr];
                    }
                }
                runs.Add(currentRun);

                // Place one door at center of each contiguous corridor entry
                foreach (var run in runs)
                {
                    var pick = run[run.Count / 2]; // center of run
                    if (doorPositions.Add((pick.Item1, pick.Item2)))
                    {
                        doors.Add(new DoorPlacement(
                            $"door-{doorId++}",
                            pick.Item1, pick.Item2,
                            room.Id,
                            pick.Item3,
                            DoorState.Open,
                            pick.Item4
                        ));
                    }
                }
            }

            // PHASE 2: If no corridor junctions were found, pick best available candidate
            // (room-to-room connection or fallback)
            var roomDoors = doors.Where(d => d.RoomId == room.Id).ToList();
            if (roomDoors.Count == 0 && candidates.Count > 0)
            {
                // Shuffle and pick best
                for (var i = candidates.Count - 1; i > 0; i--)
                {
                    var j = rng.Next(0, i + 1);
                    (candidates[i], candidates[j]) = (candidates[j], candidates[i]);
                }
                var fallback = candidates[0];
                if (doorPositions.Add((fallback.Item1, fallback.Item2)))
                {
                    doors.Add(new DoorPlacement(
                        $"door-{doorId++}",
                        fallback.Item1, fallback.Item2,
                        room.Id,
                        fallback.Item3,
                        DoorState.Open,
                        fallback.Item4
                    ));
                }
            }

            // PHASE 3: Optional extra door for larger rooms (max 1 additional, prefer opposite wall)
            roomDoors = doors.Where(d => d.RoomId == room.Id).ToList();
            var area = room.Width * room.Height;
            if (area > 50 && roomDoors.Count < 2)
            {
                var existingDirs = roomDoors.Select(d => d.Direction).ToHashSet();
                var extraCandidate = candidates
                    .Where(c => !doorPositions.Contains((c.Item1, c.Item2)))
                    .Where(c => !existingDirs.Contains(c.Item3)) // prefer different wall
                    .OrderByDescending(c => c.Item4 == "corridor" ? 1 : 0)
                    .FirstOrDefault();

                if (extraCandidate != default && doorPositions.Add((extraCandidate.Item1, extraCandidate.Item2)))
                {
                    doors.Add(new DoorPlacement(
                        $"door-{doorId++}",
                        extraCandidate.Item1, extraCandidate.Item2,
                        room.Id,
                        extraCandidate.Item3,
                        DoorState.Open,
                        extraCandidate.Item4
                    ));
                }
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
