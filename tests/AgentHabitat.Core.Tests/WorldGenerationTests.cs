using System.Text.Json;
using AgentHabitat.Core.WorldGen.Contracts;
using AgentHabitat.Core.WorldGen.Implementation;
using AgentHabitat.Core.WorldGen.Validation;

namespace AgentHabitat.Core.Tests;

public class WorldGenerationTests
{
    private readonly DeterministicWorldGenerator _gen = new();
    private readonly WorldGenerationOptions _defaultOpts = new(64, 48, 1, WorldStyleProfiles.RetroOffice, "v1");

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
    public void SameSeedAndStyle_ProduceSameHash()
    {
        var opts = _defaultOpts with { StyleProfile = WorldStyleProfiles.CozyTech };
        var a = _gen.GenerateWorld("alpha-001", opts);
        var b = _gen.GenerateWorld("alpha-001", opts);
        Assert.Equal(a.TopologyHash, b.TopologyHash);
    }

    [Fact]
    public void SameSeedDifferentStyle_ProduceDifferentHash()
    {
        var retro = _gen.GenerateWorld("alpha-001", _defaultOpts with { StyleProfile = WorldStyleProfiles.RetroOffice });
        var cozy = _gen.GenerateWorld("alpha-001", _defaultOpts with { StyleProfile = WorldStyleProfiles.CozyTech });
        var neo = _gen.GenerateWorld("alpha-001", _defaultOpts with { StyleProfile = WorldStyleProfiles.NeoIndustrial });

        Assert.NotEqual(retro.TopologyHash, cozy.TopologyHash);
        Assert.NotEqual(retro.TopologyHash, neo.TopologyHash);
        Assert.NotEqual(cozy.TopologyHash, neo.TopologyHash);
    }

    [Theory]
    [InlineData("retro-office")]
    [InlineData("cozy-tech")]
    [InlineData("neo-industrial")]
    public void AllStyles_PassValidationInvariants(string style)
    {
        var world = _gen.GenerateWorld("alpha-002", _defaultOpts with { StyleProfile = style });
        var errors = WorldValidation.Validate(world);
        Assert.Empty(errors);
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
    public void GeneratedWorld_EveryRoomHasAtLeastOneDoor()
    {
        var world = _gen.GenerateWorld("alpha-001", _defaultOpts);

        foreach (var room in world.Rooms)
        {
            var doorCount = world.Doors.Count(d => d.RoomId == room.Id);
            Assert.True(doorCount >= 1, $"Room {room.Id} ({room.Archetype}) has no doors");
        }
    }

    [Fact]
    public void GeneratedWorld_DoorsAreOnRoomPerimeter()
    {
        var world = _gen.GenerateWorld("alpha-002", _defaultOpts);

        foreach (var door in world.Doors)
        {
            var room = world.Rooms.First(r => r.Id == door.RoomId);
            var onPerimeter =
                door.X == room.X || door.X == room.X + room.Width - 1 ||
                door.Y == room.Y || door.Y == room.Y + room.Height - 1;
            Assert.True(onPerimeter, $"Door {door.Id} at ({door.X},{door.Y}) not on perimeter of {room.Id}");
        }
    }

    [Fact]
    public void GeneratedWorld_DoorsAreDeterministic()
    {
        var a = _gen.GenerateWorld("alpha-001", _defaultOpts);
        var b = _gen.GenerateWorld("alpha-001", _defaultOpts);

        Assert.Equal(a.Doors.Count, b.Doors.Count);
        for (var i = 0; i < a.Doors.Count; i++)
        {
            Assert.Equal(a.Doors[i].X, b.Doors[i].X);
            Assert.Equal(a.Doors[i].Y, b.Doors[i].Y);
            Assert.Equal(a.Doors[i].RoomId, b.Doors[i].RoomId);
            Assert.Equal(a.Doors[i].Direction, b.Doors[i].Direction);
        }
    }

    [Fact]
    public void GeneratedWorld_NoDuplicateDoorPositions()
    {
        var world = _gen.GenerateWorld("alpha-003", _defaultOpts);
        var positions = world.Doors.Select(d => (d.X, d.Y)).ToList();
        Assert.Equal(positions.Count, positions.Distinct().Count());
    }

    [Fact]
    public void PropertyStyle_AllSeedsHaveDoorsPassingValidation()
    {
        for (var i = 0; i < 50; i++)
        {
            var seed = $"door-{i:000}";
            var world = _gen.GenerateWorld(seed, _defaultOpts);
            var errors = WorldValidation.Validate(world);
            Assert.Empty(errors);

            // Every room must have at least 1 door
            foreach (var room in world.Rooms)
            {
                var doorCount = world.Doors.Count(d => d.RoomId == room.Id);
                Assert.True(doorCount >= 1, $"Seed {seed}: Room {room.Id} has no doors");
            }
        }
    }

    [Fact]
    public void GeneratedWorld_MaxTwoDoorsPerConnectionPair()
    {
        for (var i = 0; i < 50; i++)
        {
            var seed = $"pair-cap-{i:000}";
            var world = _gen.GenerateWorld(seed, _defaultOpts);

            // Count doors per connection pair (from both sides)
            var pairCounts = new Dictionary<string, int>();
            foreach (var door in world.Doors)
            {
                var a = door.RoomId;
                var b = door.ConnectsTo ?? "corridor";
                var key = string.Compare(a, b, StringComparison.Ordinal) <= 0 ? $"{a}|{b}" : $"{b}|{a}";
                pairCounts[key] = pairCounts.GetValueOrDefault(key, 0) + 1;
            }

            foreach (var (pair, count) in pairCounts)
            {
                Assert.True(count <= 2, $"Seed {seed}: pair {pair} has {count} doors (max 2)");
            }
        }
    }

    [Fact]
    public void GeneratedWorld_DoorDistributionIsReasonable()
    {
        // Over 50 seeds, average doors per room should be 1-2
        var totalDoors = 0;
        var totalRooms = 0;
        for (var i = 0; i < 50; i++)
        {
            var world = _gen.GenerateWorld($"dist-{i:000}", _defaultOpts);
            totalDoors += world.Doors.Count;
            totalRooms += world.Rooms.Count;
        }

        var avg = (double)totalDoors / totalRooms;
        Assert.True(avg >= 1.0, $"Average doors/room too low: {avg:F2}");
        Assert.True(avg <= 2.5, $"Average doors/room too high: {avg:F2}");
    }

    [Fact]
    public void GeneratedWorld_CapacityExpansion_FitsEightAgents()
    {
        var agents = Enumerable.Range(1, 8)
            .Select(i => new AgentDefinition($"agent-{i}", $"Agent {i}", "Developer"))
            .ToArray();
        var (w, h) = DeterministicWorldGenerator.ComputeRequiredSize(4, agents.Length);
        var opts = new WorldGenerationOptions(w, h, 1, WorldStyleProfiles.RetroOffice, "v1", agents);
        var world = _gen.GenerateWorld("capacity-test", opts);

        // All 8 agents should have offices
        foreach (var agent in agents)
        {
            Assert.Contains(world.Rooms, r => r.Id == $"office-{agent.Id}");
        }
        // Plus 4 shared rooms
        Assert.Equal(12, world.Rooms.Count);

        var errors = WorldValidation.Validate(world);
        Assert.Empty(errors);
    }

    [Fact]
    public void ComputeRequiredSize_ScalesWithAgentCount()
    {
        var (w1, h1) = DeterministicWorldGenerator.ComputeRequiredSize(4, 2);
        var (w2, h2) = DeterministicWorldGenerator.ComputeRequiredSize(4, 8);
        var (w3, h3) = DeterministicWorldGenerator.ComputeRequiredSize(4, 16);

        // More agents = larger world
        Assert.True(w2 * h2 > w1 * h1, "8 agents should need more space than 2");
        Assert.True(w3 * h3 > w2 * h2, "16 agents should need more space than 8");
        // Stays within bounds
        Assert.True(w3 <= 96 && h3 <= 72, "Should not exceed max bounds");
    }

    [Fact]
    public void OwnershipMap_NoDuplicates_AcrossSeeds()
    {
        for (var i = 0; i < 20; i++)
        {
            var agents = Enumerable.Range(1, 6)
                .Select(j => new AgentDefinition($"a-{j}", $"Agent {j}", "Developer"))
                .ToArray();
            var (w, h) = DeterministicWorldGenerator.ComputeRequiredSize(4, agents.Length);
            var opts = new WorldGenerationOptions(w, h, 1, WorldStyleProfiles.RetroOffice, "v1", agents);
            var world = _gen.GenerateWorld($"own-{i:000}", opts);

            var officeIds = agents.Select(a => $"office-{a.Id}").ToList();
            var foundOffices = world.Rooms.Where(r => officeIds.Contains(r.Id)).ToList();

            // Each agent has exactly one office, no dupes
            Assert.Equal(agents.Length, foundOffices.Count);
            Assert.Equal(foundOffices.Count, foundOffices.Select(r => r.Id).Distinct().Count());
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

    [Fact]
    public void SeedStyleMatrix_WritesStyleHashMatrix_ForAlphaSeedsAcrossAllStyles()
    {
        var seeds = new[] { "alpha-001", "alpha-002", "alpha-003" };
        var styles = WorldStyleProfiles.Supported;

        var rows =
            (from seed in seeds
             from style in styles
             let world = _gen.GenerateWorld(seed, _defaultOpts with { StyleProfile = style })
             select new
             {
                 seed,
                 style,
                 topologyHash = world.TopologyHash,
                 width = world.Width,
                 height = world.Height,
                 timestamp = DateTimeOffset.UtcNow.ToString("O")
             }).ToList();

        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var outDir = Path.Combine(repoRoot, "docs", "poc", "worldgen");
        Directory.CreateDirectory(outDir);
        var outPath = Path.Combine(outDir, "style-hash-matrix.json");

        var json = JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(outPath, json);

        Assert.True(File.Exists(outPath));
        Assert.Equal(seeds.Length * styles.Count, rows.Count);
    }
}
