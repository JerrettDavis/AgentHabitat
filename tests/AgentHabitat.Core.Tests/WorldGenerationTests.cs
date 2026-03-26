using AgentHabitat.Core.WorldGen.Contracts;
using AgentHabitat.Core.WorldGen.Implementation;
using AgentHabitat.Core.WorldGen.Validation;

namespace AgentHabitat.Core.Tests;

public class WorldGenerationTests
{
    [Fact]
    public void SameSeedAndOptions_ProduceSameTopologyHash()
    {
        var gen = new DeterministicWorldGenerator();
        var options = new WorldGenerationOptions(64, 48, 1, "retro-office", "v1");

        var a = gen.GenerateWorld("alpha-001", options);
        var b = gen.GenerateWorld("alpha-001", options);

        Assert.Equal(a.TopologyHash, b.TopologyHash);
    }

    [Fact]
    public void GeneratedWorld_HasNoRoomOverlap_AndAllRequiredRoomsReachable()
    {
        var gen = new DeterministicWorldGenerator();
        var options = new WorldGenerationOptions(64, 48, 1, "retro-office", "v1");

        var world = gen.GenerateWorld("alpha-002", options);
        var errors = WorldValidation.Validate(world);

        Assert.Empty(errors);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.CodingRoom);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.ReviewRoom);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.Library);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.Lounge);
    }
}
