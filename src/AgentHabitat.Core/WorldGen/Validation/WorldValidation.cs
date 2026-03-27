using AgentHabitat.Core.WorldGen.Contracts;

namespace AgentHabitat.Core.WorldGen.Validation;

public static class WorldValidation
{
    public static IReadOnlyList<string> Validate(WorldGenerationResult world)
    {
        var errors = new List<string>();

        // Rule 1: no room overlap
        var rooms = world.Rooms.ToList();
        for (var i = 0; i < rooms.Count; i++)
        {
            for (var j = i + 1; j < rooms.Count; j++)
            {
                if (Overlap(rooms[i], rooms[j]))
                {
                    errors.Add($"Overlap: {rooms[i].Id} intersects {rooms[j].Id}");
                }
            }
        }

        // Rule 2: every room has at least one door
        var roomDoorCounts = new Dictionary<string, int>();
        foreach (var room in rooms)
            roomDoorCounts[room.Id] = 0;

        foreach (var door in world.Doors)
        {
            if (roomDoorCounts.ContainsKey(door.RoomId))
                roomDoorCounts[door.RoomId]++;

            // Rule 3: doors must be on room perimeter
            var ownerRoom = rooms.FirstOrDefault(r => r.Id == door.RoomId);
            if (ownerRoom != null)
            {
                var onPerimeter =
                    door.X == ownerRoom.X || door.X == ownerRoom.X + ownerRoom.Width - 1 ||
                    door.Y == ownerRoom.Y || door.Y == ownerRoom.Y + ownerRoom.Height - 1;
                if (!onPerimeter)
                    errors.Add($"Door {door.Id} not on perimeter of {door.RoomId}");

                var inRoom = door.X >= ownerRoom.X && door.X < ownerRoom.X + ownerRoom.Width &&
                             door.Y >= ownerRoom.Y && door.Y < ownerRoom.Y + ownerRoom.Height;
                if (!inRoom)
                    errors.Add($"Door {door.Id} outside bounds of {door.RoomId}");
            }
            else
            {
                errors.Add($"Door {door.Id} references unknown room {door.RoomId}");
            }
        }

        foreach (var (roomId, count) in roomDoorCounts)
        {
            if (count == 0)
                errors.Add($"Room {roomId} has no doors");
        }

        // Rule 4: no duplicate door positions
        var doorPositions = new HashSet<(int, int)>();
        foreach (var door in world.Doors)
        {
            if (!doorPositions.Add((door.X, door.Y)))
                errors.Add($"Duplicate door position at ({door.X},{door.Y})");
        }

        // Rule 5: every room with corridor access must have at least one corridor-facing door
        foreach (var room in rooms)
        {
            var hasCorridorNeighbor = false;
            for (var x = room.X; x < room.X + room.Width && !hasCorridorNeighbor; x++)
            {
                for (var y = room.Y; y < room.Y + room.Height && !hasCorridorNeighbor; y++)
                {
                    var onPerimeter = x == room.X || x == room.X + room.Width - 1 ||
                                     y == room.Y || y == room.Y + room.Height - 1;
                    if (!onPerimeter) continue;

                    foreach (var (nx, ny) in new[] { (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1) })
                    {
                        if (nx < 0 || ny < 0 || nx >= world.Width || ny >= world.Height) continue;
                        if (!world.Walkable[nx, ny]) continue;
                        var inAnyRoom = rooms.Any(r =>
                            nx >= r.X && nx < r.X + r.Width && ny >= r.Y && ny < r.Y + r.Height);
                        if (!inAnyRoom) { hasCorridorNeighbor = true; break; }
                    }
                }
            }

            if (hasCorridorNeighbor)
            {
                var hasCorridorDoor = world.Doors.Any(d =>
                    d.RoomId == room.Id && d.ConnectsTo == "corridor");
                if (!hasCorridorDoor)
                    errors.Add($"Room {room.Id} has corridor access but no corridor-facing door");
            }
        }

        // Rule 6: all required rooms reachable via walkable graph
        if (rooms.Count > 0)
        {
            var reachable = FloodFill(world.Walkable, rooms[0].CenterX, rooms[0].CenterY);
            foreach (var room in rooms)
            {
                if (!reachable.Contains((room.CenterX, room.CenterY)))
                {
                    errors.Add($"Unreachable room: {room.Id} ({room.Archetype})");
                }
            }
        }

        // Rule 7: door-aware reachability — every room reachable through open doors
        // Build room connectivity graph from doors
        if (rooms.Count > 0)
        {
            var roomGraph = new Dictionary<string, HashSet<string>>();
            foreach (var room in rooms)
                roomGraph[room.Id] = [];
            roomGraph["corridor"] = [];

            foreach (var door in world.Doors)
            {
                var target = door.ConnectsTo ?? "corridor";
                if (!roomGraph.ContainsKey(target)) roomGraph[target] = [];
                roomGraph[door.RoomId].Add(target);
                roomGraph[target].Add(door.RoomId);
            }

            // BFS from first room through door graph
            var visited = new HashSet<string> { rooms[0].Id };
            var queue = new Queue<string>();
            queue.Enqueue(rooms[0].Id);
            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                if (roomGraph.TryGetValue(current, out var neighbors))
                {
                    foreach (var n in neighbors)
                    {
                        if (visited.Add(n)) queue.Enqueue(n);
                    }
                }
            }

            foreach (var room in rooms)
            {
                if (!visited.Contains(room.Id))
                    errors.Add($"Room {room.Id} not reachable through door graph");
            }
        }

        return errors;
    }

    private static HashSet<(int x, int y)> FloodFill(bool[,] walkable, int startX, int startY)
    {
        var width = walkable.GetLength(0);
        var height = walkable.GetLength(1);
        var visited = new HashSet<(int x, int y)>();
        var q = new Queue<(int x, int y)>();

        if (startX < 0 || startY < 0 || startX >= width || startY >= height || !walkable[startX, startY])
            return visited;

        q.Enqueue((startX, startY));
        visited.Add((startX, startY));

        var dirs = new (int dx, int dy)[] { (1, 0), (-1, 0), (0, 1), (0, -1) };

        while (q.Count > 0)
        {
            var (x, y) = q.Dequeue();
            foreach (var (dx, dy) in dirs)
            {
                var nx = x + dx;
                var ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (!walkable[nx, ny]) continue;
                if (visited.Add((nx, ny))) q.Enqueue((nx, ny));
            }
        }

        return visited;
    }

    private static bool Overlap(RoomPlacement a, RoomPlacement b)
    {
        return a.X < b.X + b.Width &&
               a.X + a.Width > b.X &&
               a.Y < b.Y + b.Height &&
               a.Y + a.Height > b.Y;
    }
}
