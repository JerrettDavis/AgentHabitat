namespace AgentHabitat.Web.Services;

public class PresenceService
{
    private readonly Dictionary<string, PresenceEntry> _entries = new();
    private readonly TimeSpan _staleTimeout = TimeSpan.FromSeconds(30);
    private readonly TimeSpan _offlineTimeout = TimeSpan.FromSeconds(60);

    public IReadOnlyDictionary<string, PresenceEntry> Entries => _entries;

    public void Heartbeat(string agentId, int x, int y, string status)
    {
        _entries[agentId] = new PresenceEntry(agentId, x, y, status, DateTime.UtcNow);
    }

    public void Remove(string agentId) => _entries.Remove(agentId);

    public void CleanupStale()
    {
        var now = DateTime.UtcNow;
        var toRemove = new List<string>();
        var toMarkStale = new List<string>();

        foreach (var (id, entry) in _entries)
        {
            var age = now - entry.LastSeen;
            if (age > _offlineTimeout)
                toRemove.Add(id);
            else if (age > _staleTimeout && entry.Status != "stale")
                toMarkStale.Add(id);
        }

        foreach (var id in toMarkStale)
            _entries[id] = _entries[id] with { Status = "stale" };
        foreach (var id in toRemove)
            _entries.Remove(id);
    }

    public PresenceSnapshot GetSnapshot()
    {
        CleanupStale();
        return new PresenceSnapshot(
            _entries.Values.ToArray(),
            _entries.Count,
            _entries.Count(e => e.Value.Status == "active"),
            _entries.Count(e => e.Value.Status == "stale"),
            DateTime.UtcNow
        );
    }

    // Simulate presence for all current agents (for demo/testing)
    public void SimulatePresence(IEnumerable<(string Id, int X, int Y, string Status)> agents)
    {
        foreach (var (id, x, y, status) in agents)
            Heartbeat(id, x, y, status);
    }
}

public record PresenceEntry(
    string AgentId,
    int X,
    int Y,
    string Status,
    DateTime LastSeen
);

public record PresenceSnapshot(
    PresenceEntry[] Entries,
    int TotalCount,
    int ActiveCount,
    int StaleCount,
    DateTime Timestamp
);
