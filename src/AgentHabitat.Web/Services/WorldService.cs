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

        // Generate objects with curated room layout kits ("lived-in" presets)
        var objects = new List<ObjectRenderData>();
        var objId = 1;

        void Place(string type, int x, int y, string roomId)
        {
            if (x >= 0 && y >= 0 && x < world.Width && y < world.Height)
                objects.Add(new ObjectRenderData($"obj-{objId++}", type, x, y, roomId));
        }

        foreach (var r in world.Rooms)
        {
            var rng = new Random(r.X * 1000 + r.Y);
            var cx = r.X + r.Width / 2;
            var cy = r.Y + r.Height / 2;

            switch (r.Archetype)
            {
                case RoomArchetype.CodingRoom:
                    // Desk islands (2 rows of workstations)
                    for (var row = 0; row < Math.Min(2, r.Height / 3); row++)
                    {
                        var dy = r.Y + 2 + row * 3;
                        Place("desk", r.X + 2, dy, r.Id);
                        Place("monitor", r.X + 3, dy, r.Id);
                        Place("chair", r.X + 4, dy, r.Id);
                        if (r.Width > 7)
                        {
                            Place("desk", r.X + r.Width - 4, dy, r.Id);
                            Place("monitor", r.X + r.Width - 3, dy, r.Id);
                            Place("chair", r.X + r.Width - 5, dy, r.Id);
                        }
                    }
                    // Whiteboard wall
                    Place("whiteboard", cx, r.Y + 1, r.Id);
                    // Coffee corner
                    Place("coffee", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    Place("mug", r.X + r.Width - 2, r.Y + r.Height - 3, r.Id);
                    // Plant + trash
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    Place("trash", r.X + 1, r.Y + 1, r.Id);
                    // Cable clutter
                    Place("cables", r.X + 3, r.Y + r.Height - 2, r.Id);
                    // Wall clock
                    Place("clock", cx + 2, r.Y + 1, r.Id);
                    break;

                case RoomArchetype.ReviewRoom:
                    // Conference table (center)
                    Place("table", cx - 1, cy, r.Id);
                    Place("table", cx, cy, r.Id);
                    Place("table", cx + 1, cy, r.Id);
                    // Chairs around table
                    Place("chair", cx - 1, cy - 1, r.Id);
                    Place("chair", cx, cy - 1, r.Id);
                    Place("chair", cx + 1, cy - 1, r.Id);
                    Place("chair", cx - 1, cy + 1, r.Id);
                    Place("chair", cx + 1, cy + 1, r.Id);
                    // Presentation screen
                    Place("screen", cx, r.Y + 1, r.Id);
                    // Whiteboard
                    Place("whiteboard", r.X + 1, cy, r.Id);
                    // Water cooler
                    Place("cooler", r.X + r.Width - 2, r.Y + 1, r.Id);
                    // Bulletin board
                    Place("bulletin", r.X + r.Width - 2, cy, r.Id);
                    // Plant
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    // Notes/papers
                    Place("papers", cx + 1, cy + 1, r.Id);
                    break;

                case RoomArchetype.Library:
                    // Wall shelves (left + right walls)
                    for (var sy = r.Y + 1; sy < r.Y + r.Height - 1; sy += 2)
                    {
                        Place("bookshelf", r.X + 1, sy, r.Id);
                        if (r.Width > 5) Place("bookshelf", r.X + r.Width - 2, sy, r.Id);
                    }
                    // Reading nook (center)
                    Place("chair", cx, cy, r.Id);
                    Place("lamp", cx + 1, cy, r.Id);
                    Place("desk", cx - 1, cy, r.Id);
                    // Rug under reading area
                    Place("rug", cx, cy + 1, r.Id);
                    // Globe or art
                    Place("globe", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    // Plant
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    // Clock
                    Place("clock", cx, r.Y + 1, r.Id);
                    break;

                default: // Lounge
                    // Couch cluster
                    Place("couch", r.X + 2, r.Y + 2, r.Id);
                    if (r.Width > 6) Place("couch", r.X + 4, r.Y + 2, r.Id);
                    // Coffee table
                    Place("table", r.X + 3, r.Y + 4, r.Id);
                    // TV/screen
                    Place("screen", cx, r.Y + 1, r.Id);
                    // Vending machine
                    Place("vending", r.X + r.Width - 2, r.Y + 1, r.Id);
                    // Plants (multiple)
                    Place("plant", r.X + 1, r.Y + 1, r.Id);
                    Place("plant", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    // Rug
                    Place("rug", r.X + 3, r.Y + 3, r.Id);
                    // Lamp
                    Place("lamp", r.X + r.Width - 2, cy, r.Id);
                    // Magazines/papers
                    Place("papers", r.X + 3, r.Y + 5, r.Id);
                    // Coat rack
                    Place("coatrack", r.X + 1, r.Y + r.Height - 2, r.Id);
                    // Mug on table
                    Place("mug", r.X + 4, r.Y + 4, r.Id);
                    break;
            }
        }

        // Corridor dressing — add plants and mats near room doors
        for (var y = 0; y < world.Height; y++)
        {
            for (var x = 0; x < world.Width; x++)
            {
                if (!world.Walkable[x, y]) continue;
                var inRoom = world.Rooms.Any(r =>
                    x >= r.X && x < r.X + r.Width && y >= r.Y && y < r.Y + r.Height);
                if (inRoom) continue;

                // Sparse corridor decoration (deterministic)
                var hash = x * 73 + y * 137;
                if (hash % 23 == 0) Place("plant", x, y, "corridor");
                else if (hash % 31 == 0) Place("mat", x, y, "corridor");
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
