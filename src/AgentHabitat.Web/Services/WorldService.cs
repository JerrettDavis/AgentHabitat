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

        return new WorldRenderData(
            world.Width,
            world.Height,
            tiles,
            rooms,
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
    string Seed,
    string Style,
    string TopologyHash
);

public record RoomRenderData(
    string Id,
    string Archetype,
    int X,
    int Y,
    int Width,
    int Height
);
