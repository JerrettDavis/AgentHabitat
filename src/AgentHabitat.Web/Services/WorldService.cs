using AgentHabitat.Core.WorldGen.Contracts;
using AgentHabitat.Core.WorldGen.Implementation;

namespace AgentHabitat.Web.Services;

public class WorldService
{
    private readonly DeterministicWorldGenerator _generator = new();

    public static readonly Dictionary<string, WorldPreset> Presets = new()
    {
        ["startup-office"] = new("Startup Office", "startup-hq", "retro-office",
            "Open-plan startup with coding pods, a war room, and a cozy lounge"),
        ["research-lab"] = new("Research Lab", "lab-alpha", "forest-lab",
            "Quiet research facility with library, review room, and green spaces"),
        ["cozy-studio"] = new("Cozy Studio", "studio-zen", "neon-hq",
            "Creative studio with reading nooks, art walls, and ambient lighting"),
        ["corporate-hq"] = new("Corporate HQ", "corp-tower-1", "retro-office",
            "Formal corporate headquarters with executive suites and structured workspaces"),
        ["custom"] = new("Custom", "alpha-001", "retro-office", "Enter your own seed and style"),
    };

    public static readonly AgentDefinition[] DefaultAgents =
    [
        new("claude", "Claude", "Developer"),
        new("copilot", "Copilot", "Developer"),
        new("jdai", "JD.AI", "Assistant"),
        new("ralph", "Ralph", "Triage"),
    ];

    public WorldGenerationResult Generate(string seed, string style = "retro-office",
        IReadOnlyList<AgentDefinition>? agents = null)
    {
        var agentList = agents ?? DefaultAgents;
        // Scale world to fit shared rooms + private offices
        var baseWidth = 32;
        var baseHeight = 24;
        var extraSpace = agentList.Count * 3; // ~3 tiles per office width contribution
        var width = Math.Min(64, baseWidth + extraSpace);
        var height = Math.Min(48, baseHeight + extraSpace / 2);

        var options = new WorldGenerationOptions(
            Width: width,
            Height: height,
            CorridorWidth: 2,
            StyleProfile: style,
            ContentPackVersion: "v1",
            Agents: agentList
        );

        return _generator.GenerateWorld(seed, options);
    }

    public WorldGenerationResult GenerateFromPreset(string presetId)
    {
        var preset = Presets.GetValueOrDefault(presetId) ?? Presets["custom"];
        return Generate(preset.Seed, preset.Style);
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
                        Place("keyboard", r.X + 2, dy + 1, r.Id);
                        if (r.Width > 7)
                        {
                            Place("desk", r.X + r.Width - 4, dy, r.Id);
                            Place("monitor", r.X + r.Width - 3, dy, r.Id);
                            Place("chair", r.X + r.Width - 5, dy, r.Id);
                            Place("headphones", r.X + r.Width - 4, dy + 1, r.Id);
                        }
                    }
                    // Whiteboard wall
                    Place("whiteboard", cx, r.Y + 1, r.Id);
                    // Coffee corner
                    Place("coffee", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    Place("mug", r.X + r.Width - 2, r.Y + r.Height - 3, r.Id);
                    Place("snack-bowl", r.X + r.Width - 3, r.Y + r.Height - 2, r.Id);
                    // Plant + trash
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    Place("trash", r.X + 1, r.Y + 1, r.Id);
                    // Cable clutter + server
                    Place("cables", r.X + 3, r.Y + r.Height - 2, r.Id);
                    if (r.Width > 8) Place("server", r.X + r.Width - 2, cy, r.Id);
                    // Wall clock + calendar
                    Place("clock", cx + 2, r.Y + 1, r.Id);
                    Place("calendar", r.X + 1, cy, r.Id);
                    // Fire extinguisher near door
                    Place("fire-ext", r.X + 1, r.Y + 2, r.Id);
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
                    // Water cooler + snacks
                    Place("cooler", r.X + r.Width - 2, r.Y + 1, r.Id);
                    Place("snack-bowl", r.X + r.Width - 3, r.Y + 1, r.Id);
                    // Bulletin board + calendar
                    Place("bulletin", r.X + r.Width - 2, cy, r.Id);
                    Place("calendar", r.X + r.Width - 2, cy + 1, r.Id);
                    // Plant + art
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    Place("art-frame", r.X + 1, r.Y + 1, r.Id);
                    // Notes/papers
                    Place("papers", cx + 1, cy + 1, r.Id);
                    // Pens on table
                    Place("mug", cx - 1, cy + 1, r.Id);
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
                    // Globe, art, potted tree
                    Place("globe", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    Place("art-frame", cx, r.Y + 1, r.Id);
                    Place("potted-tree", r.X + r.Width - 2, r.Y + 1, r.Id);
                    // Plant
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    // Clock + window
                    Place("clock", cx + 2, r.Y + 1, r.Id);
                    if (r.Width > 6) Place("window", r.X + 1, r.Y + 1, r.Id);
                    break;

                case RoomArchetype.PrivateOffice:
                    // Personal desk + monitor + keyboard (against back wall)
                    Place("desk", cx, r.Y + 1, r.Id);
                    Place("monitor", cx, r.Y + 1, r.Id);
                    Place("keyboard", cx - 1, r.Y + 2, r.Id);
                    Place("chair", cx, r.Y + 2, r.Id);
                    // Personal items based on office owner role
                    var ownerAgent = (world.Options.Agents ?? [])
                        .FirstOrDefault(a => r.Id == $"office-{a.Id}");
                    if (ownerAgent?.Role == "Developer")
                    {
                        Place("cables", r.X + 1, r.Y + 1, r.Id);
                        Place("mug", cx + 1, r.Y + 2, r.Id);
                        Place("headphones", cx + 1, r.Y + 1, r.Id);
                        if (r.Width > 5) Place("bookshelf", r.X + r.Width - 2, r.Y + 1, r.Id);
                        if (r.Width > 6) Place("server", r.X + r.Width - 2, r.Y + 2, r.Id);
                    }
                    else if (ownerAgent?.Role == "Assistant")
                    {
                        Place("papers", r.X + 1, r.Y + 1, r.Id);
                        Place("filing", r.X + r.Width - 2, r.Y + 1, r.Id);
                        Place("calendar", r.X + 1, r.Y + 2, r.Id);
                        Place("plant", r.X + r.Width - 2, r.Y + 2, r.Id);
                    }
                    else if (ownerAgent?.Role == "Triage")
                    {
                        Place("bulletin", r.X + 1, r.Y + 1, r.Id);
                        Place("clock", cx + 1, r.Y + 1, r.Id);
                        Place("papers", r.X + 1, r.Y + 2, r.Id);
                        if (r.Width > 5) Place("screen", r.X + r.Width - 2, r.Y + 1, r.Id);
                    }
                    else
                    {
                        Place("art-frame", r.X + 1, r.Y + 1, r.Id);
                        Place("mug", cx + 1, r.Y + 2, r.Id);
                    }
                    // Common personal items
                    Place("plant", r.X + 1, r.Y + r.Height - 2, r.Id);
                    Place("lamp", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    Place("trash", r.X + r.Width - 2, cy, r.Id);
                    if (r.Height > 4) Place("rug", cx, cy + 1, r.Id);
                    if (r.Width > 5) Place("window", cx, r.Y + r.Height - 2, r.Id);
                    Place("snack-bowl", r.X + 1, cy, r.Id);
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
                    // Plants (multiple) + potted tree
                    Place("plant", r.X + 1, r.Y + 1, r.Id);
                    Place("plant", r.X + r.Width - 2, r.Y + r.Height - 2, r.Id);
                    Place("potted-tree", r.X + 1, cy, r.Id);
                    // Rug
                    Place("rug", r.X + 3, r.Y + 3, r.Id);
                    // Lamp + art
                    Place("lamp", r.X + r.Width - 2, cy, r.Id);
                    Place("art-frame", cx + 2, r.Y + 1, r.Id);
                    // Magazines/papers + snacks
                    Place("papers", r.X + 3, r.Y + 5, r.Id);
                    Place("snack-bowl", r.X + 4, r.Y + 5, r.Id);
                    // Coat rack + fan
                    Place("coatrack", r.X + 1, r.Y + r.Height - 2, r.Id);
                    Place("fan", r.X + r.Width - 2, r.Y + r.Height - 3, r.Id);
                    // Mug on table + window
                    Place("mug", r.X + 4, r.Y + 4, r.Id);
                    if (r.Width > 7) Place("window", r.X + r.Width - 2, r.Y + 2, r.Id);
                    // Fire ext
                    Place("fire-ext", r.X + 1, r.Y + 2, r.Id);
                    break;
            }
            // Density variation: bonus decorations based on room area
            var area = r.Width * r.Height;
            var bonusCount = area > 60 ? 4 : area > 40 ? 3 : area > 25 ? 2 : 1;
            string[] bonusTypes = ["plant", "papers", "mug", "trash", "rug", "clock", "bulletin", "snack-bowl", "calendar", "headphones", "fan"];

            for (var b = 0; b < bonusCount; b++)
            {
                var bx = rng.Next(r.X + 1, r.X + r.Width - 1);
                var by = rng.Next(r.Y + 2, r.Y + r.Height - 1);
                var bType = bonusTypes[rng.Next(bonusTypes.Length)];
                // Avoid placing on walkway (center column)
                if (bx != cx || by != cy)
                    Place(bType, bx, by, r.Id);
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

        // Generate agents — each agent spawns in their private office
        var agentColors = new Dictionary<string, string>
        {
            ["claude"] = "#f97316", ["copilot"] = "#3b82f6",
            ["jdai"] = "#22c55e", ["ralph"] = "#a855f7",
        };
        var defaultColor = "#888888";

        var agents = new List<AgentRenderData>();
        var agentDefs = world.Options.Agents ?? DefaultAgents;
        for (var i = 0; i < agentDefs.Count; i++)
        {
            var def = agentDefs[i];
            // Find agent's personal office, fallback to shared room
            var office = world.Rooms.FirstOrDefault(r => r.Id == $"office-{def.Id}")
                         ?? (i < world.Rooms.Count ? world.Rooms[i] : world.Rooms[^1]);
            var color = agentColors.GetValueOrDefault(def.Id, defaultColor);
            agents.Add(new AgentRenderData(def.Id, def.Name, color, def.Role,
                office.CenterX, office.CenterY, i < 2 ? "active" : i < 3 ? "idle" : "offline"));
        }

        var doors = world.Doors.Select(d => new DoorRenderData(
            d.Id, d.X, d.Y, d.RoomId, d.Direction.ToString(), d.State.ToString(), d.ConnectsTo
        )).ToArray();

        return new WorldRenderData(
            world.Width,
            world.Height,
            tiles,
            rooms,
            objects.ToArray(),
            agents.ToArray(),
            doors,
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
    DoorRenderData[] Doors,
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

public record WorldPreset(
    string Name,
    string Seed,
    string Style,
    string Description
);

public record DoorRenderData(
    string Id,
    int X,
    int Y,
    string RoomId,
    string Direction,
    string State,
    string? ConnectsTo
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
