namespace AgentHabitat.Core.WorldGen.Contracts;

public enum RoomArchetype
{
    CodingRoom,
    ReviewRoom,
    Library,
    Lounge
}

public static class WorldStyleProfiles
{
    public const string RetroOffice = "retro-office";
    public const string CozyTech = "cozy-tech";
    public const string NeoIndustrial = "neo-industrial";

    public static readonly IReadOnlyList<string> Supported =
    [
        RetroOffice,
        CozyTech,
        NeoIndustrial
    ];
}

public sealed record WorldGenerationOptions(
    int Width = 64,
    int Height = 48,
    int CorridorWidth = 1,
    string StyleProfile = WorldStyleProfiles.RetroOffice,
    string ContentPackVersion = "v1"
);

public sealed record RoomPlacement(
    string Id,
    RoomArchetype Archetype,
    int X,
    int Y,
    int Width,
    int Height
)
{
    public int CenterX => X + Width / 2;
    public int CenterY => Y + Height / 2;
}

public enum DoorDirection { North, East, South, West }

public enum DoorState { Open, Closed, Locked }

public sealed record DoorPlacement(
    string Id,
    int X,
    int Y,
    string RoomId,
    DoorDirection Direction,
    DoorState State,
    string? ConnectsTo // roomId, "corridor", or null
);

public sealed record WorldGenerationResult(
    int Width,
    int Height,
    IReadOnlyList<RoomPlacement> Rooms,
    IReadOnlyList<DoorPlacement> Doors,
    bool[,] Walkable,
    string TopologyHash,
    string Seed,
    WorldGenerationOptions Options
);

public interface IWorldGenerator
{
    WorldGenerationResult GenerateWorld(string seed, WorldGenerationOptions options);
}
