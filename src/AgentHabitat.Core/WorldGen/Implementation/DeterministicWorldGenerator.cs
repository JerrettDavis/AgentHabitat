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

        var topoHash = ComputeTopologyHash(seed, options, rooms, walkable);

        return new WorldGenerationResult(
            options.Width,
            options.Height,
            rooms,
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
