using System.Text.Json;
using AgentHabitat.Core.WorldGen.Contracts;
using AgentHabitat.Core.WorldGen.Implementation;
using AgentHabitat.Core.WorldGen.Validation;

namespace AgentHabitat.Core.Tests;

public class WorldGenerationTests
{
    private readonly DeterministicWorldGenerator _gen = new();
    private readonly WorldGenerationOptions _defaultOpts = new(64, 48, 1, "retro-office", "v1");

    [Fact]
    public void SameSeedAndOptions_ProduceSameTopologyHash()
    {
        var a = _gen.GenerateWorld("alpha-001", _defaultOpts);
        var b = _gen.GenerateWorld("alpha-001", _defaultOpts);

        Assert.Equal(a.TopologyHash, b.TopologyHash);
    }

    [Fact]
    public void DifferentSeeds_ProduceDifferentTopologyHashes()
    {
        var a = _gen.GenerateWorld("alpha-001", _defaultOpts);
        var b = _gen.GenerateWorld("alpha-002", _defaultOpts);

        Assert.NotEqual(a.TopologyHash, b.TopologyHash);
    }

    [Fact]
    public void GeneratedWorld_HasAllRequiredRoomArchetypes()
    {
        var world = _gen.GenerateWorld("alpha-001", _defaultOpts);

        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.CodingRoom);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.ReviewRoom);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.Library);
        Assert.Contains(world.Rooms, r => r.Archetype == RoomArchetype.Lounge);
    }

    [Fact]
    public void GeneratedWorld_HasNoRoomOverlap()
    {
        var world = _gen.GenerateWorld("alpha-002", _defaultOpts);

        for (var i = 0; i < world.Rooms.Count; i++)
        {
            for (var j = i + 1; j < world.Rooms.Count; j++)
            {
                var a = world.Rooms[i];
                var b = world.Rooms[j];
                var overlaps = a.X < b.X + b.Width && a.X + a.Width > b.X
                            && a.Y < b.Y + b.Height && a.Y + a.Height > b.Y;
                Assert.False(overlaps, $"Rooms {a.Id} and {b.Id} overlap");
            }
        }
    }

    [Fact]
    public void GeneratedWorld_AllRoomsReachable()
    {
        var world = _gen.GenerateWorld("alpha-003", _defaultOpts);

        // BFS from first room center to verify all rooms are reachable
        var visited = new bool[world.Width, world.Height];
        var queue = new Queue<(int x, int y)>();
        var start = world.Rooms[0];
        queue.Enqueue((start.CenterX, start.CenterY));
        visited[start.CenterX, start.CenterY] = true;

        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            foreach (var (dx, dy) in new[] { (0, 1), (0, -1), (1, 0), (-1, 0) })
            {
                var nx = x + dx;
                var ny = y + dy;
                if (nx >= 0 && nx < world.Width && ny >= 0 && ny < world.Height
                    && world.Walkable[nx, ny] && !visited[nx, ny])
                {
                    visited[nx, ny] = true;
                    queue.Enqueue((nx, ny));
                }
            }
        }

        foreach (var room in world.Rooms)
        {
            Assert.True(visited[room.CenterX, room.CenterY],
                $"Room {room.Id} ({room.Archetype}) at ({room.CenterX},{room.CenterY}) is not reachable");
        }
    }

    [Fact]
    public void GeneratedWorld_PassesValidation()
    {
        var world = _gen.GenerateWorld("alpha-002", _defaultOpts);
        var errors = WorldValidation.Validate(world);

        Assert.Empty(errors);
    }

    [Fact]
    public void GeneratedWorld_RoomsWithinBounds()
    {
        var world = _gen.GenerateWorld("alpha-001", _defaultOpts);

        foreach (var room in world.Rooms)
        {
            Assert.True(room.X >= 0, $"Room {room.Id} X={room.X} is out of bounds");
            Assert.True(room.Y >= 0, $"Room {room.Id} Y={room.Y} is out of bounds");
            Assert.True(room.X + room.Width <= world.Width, $"Room {room.Id} exceeds right bound");
            Assert.True(room.Y + room.Height <= world.Height, $"Room {room.Id} exceeds bottom bound");
        }
    }

    [Fact]
    public void GeneratedWorld_WalkableGridMatchesDimensions()
    {
        var world = _gen.GenerateWorld("alpha-001", _defaultOpts);

        Assert.Equal(world.Width, world.Walkable.GetLength(0));
        Assert.Equal(world.Height, world.Walkable.GetLength(1));
    }

    [Theory]
    [InlineData("alpha-001")]
    [InlineData("alpha-002")]
    [InlineData("alpha-003")]
    [InlineData("beta-001")]
    [InlineData("gamma-seed-long-name")]
    public void MultipleSeeds_AllProduceValidWorlds(string seed)
    {
        var world = _gen.GenerateWorld(seed, _defaultOpts);
        var errors = WorldValidation.Validate(world);

        Assert.Empty(errors);
        Assert.True(world.Rooms.Count >= 4, $"Expected at least 4 rooms, got {world.Rooms.Count}");
        Assert.False(string.IsNullOrEmpty(world.TopologyHash));
    }

    [Fact]
    public void PropertyStyle_InvariantLoopAcrossNSeeds_NoOverlapOrReachabilityBreaks()
    {
        for (var i = 0; i < 50; i++)
        {
            var seed = $"prop-{i:000}";
            var world = _gen.GenerateWorld(seed, _defaultOpts);
            var errors = WorldValidation.Validate(world);
            Assert.Empty(errors);
        }
    }

    [Fact]
    public void Determinism_RunsIdenticalAcross100Iterations()
    {
        var first = _gen.GenerateWorld("stability-check", _defaultOpts);

        for (var i = 0; i < 100; i++)
        {
            var result = _gen.GenerateWorld("stability-check", _defaultOpts);
            Assert.Equal(first.TopologyHash, result.TopologyHash);
            Assert.Equal(first.Rooms.Count, result.Rooms.Count);
        }
    }

    [Fact]
    public void SeedPack_WritesHashSamplesArtifact_ForAlphaAndExtendedSeeds()
    {
        var seeds = new[] { "alpha-001", "alpha-002", "alpha-003", "beta-001", "gamma-001" };
        var rows = seeds
            .Select(seed => _gen.GenerateWorld(seed, _defaultOpts))
            .Select(w => new
            {
                seed = w.Seed,
                style = w.Options.StyleProfile,
                width = w.Width,
                height = w.Height,
                topologyHash = w.TopologyHash,
                timestamp = DateTimeOffset.UtcNow.ToString("O")
            })
            .ToList();

        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var outDir = Path.Combine(repoRoot, "docs", "poc", "worldgen");
        Directory.CreateDirectory(outDir);
        var outPath = Path.Combine(outDir, "hash-samples.json");

        var json = JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(outPath, json);

        Assert.True(File.Exists(outPath));
        Assert.True(rows.Count == 5);
    }
}
