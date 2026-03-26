using AgentHabitat.Core.WorldGen.Contracts;
using AgentHabitat.Core.WorldGen.Implementation;

namespace AgentHabitat.Web.Services;

public class WorldService
{
    private readonly DeterministicWorldGenerator _generator = new();

    public WorldGenerationResult Generate(string seed, string style = "retro-office")
    {
        var options = new WorldGenerationOptions(
            Width: 32,
            Height: 24,
            CorridorWidth: 2,
            StyleProfile: style,
            ContentPackVersion: "v1"
        );

        return _generator.GenerateWorld(seed, options);
    }

    public WorldRenderData ToRenderData(WorldGenerationResult world)
    {
        var tiles = new int[world.Width * world.Height];
        var rooms = world.Rooms.Select(r => new RoomRenderData(
            r.Id, r.Archetype.ToString(), r.X, r.Y, r.Width, r.Height
        )).ToArray();

        // Encode walkable grid as flat array
        for (var y = 0; y < world.Height; y++)
        {
            for (var x = 0; x < world.Width; x++)
            {
                var inRoom = world.Rooms.Any(r =>
                    x >= r.X && x < r.X + r.Width &&
                    y >= r.Y && y < r.Y + r.Height);

                tiles[y * world.Width + x] = world.Walkable[x, y]
                    ? (inRoom ? 2 : 1)  // 2 = room floor, 1 = corridor
                    : 0;                  // 0 = wall/void
            }
        }

        // Generate objects per room archetype
        var objects = new List<ObjectRenderData>();
        var objId = 1;
        foreach (var r in world.Rooms)
        {
            var archetype = r.Archetype.ToString();
            string[] types = archetype switch
            {
                "CodingRoom" => ["desk", "monitor", "chair"],
                "ReviewRoom" => ["whiteboard", "chair", "chair"],
                "Library" => ["bookshelf", "bookshelf", "lamp"],
                _ => ["couch", "plant", "lamp"],
            };
            // Place 3-4 objects per room
            var rng = new Random(r.X * 1000 + r.Y); // deterministic per-room
            foreach (var t in types)
            {
                var ox = rng.Next(r.X + 1, r.X + r.Width - 1);
                var oy = rng.Next(r.Y + 1, r.Y + r.Height - 1);
                objects.Add(new ObjectRenderData($"obj-{objId++}", t, ox, oy, r.Id));
            }
        }

        // Generate agents (one per required room)
        var agentDefs = new[]
        {
            ("claude", "Claude", "#f97316", "Developer"),
            ("copilot", "Copilot", "#3b82f6", "Developer"),
            ("jdai", "JD.AI", "#22c55e", "Assistant"),
            ("ralph", "Ralph", "#a855f7", "Triage"),
        };

        var agents = new List<AgentRenderData>();
        for (var i = 0; i < Math.Min(agentDefs.Length, world.Rooms.Count); i++)
        {
            var r = world.Rooms[i];
            var (id, name, color, role) = agentDefs[i];
            agents.Add(new AgentRenderData(id, name, color, role,
                r.CenterX, r.CenterY, i < 2 ? "active" : i < 3 ? "idle" : "offline"));
        }

        return new WorldRenderData(
            world.Width,
            world.Height,
            tiles,
            rooms,
            objects.ToArray(),
            agents.ToArray(),
            world.Seed,
            world.Options.StyleProfile,
            world.TopologyHash
        );
    }
}

public record WorldRenderData(
    int Width,
    int Height,
    int[] Tiles,
    RoomRenderData[] Rooms,
    ObjectRenderData[] Objects,
    AgentRenderData[] Agents,
    string Seed,
    string Style,
    string TopologyHash
);

public record ObjectRenderData(
    string Id,
    string Type,
    int X,
    int Y,
    string RoomId
);

public record RoomRenderData(
    string Id,
    string Archetype,
    int X,
    int Y,
    int Width,
    int Height
);

public record AgentRenderData(
    string Id,
    string Name,
    string Color,
    string Role,
    int X,
    int Y,
    string Status
);
