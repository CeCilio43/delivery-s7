using System.Globalization;

namespace Delivery.Common;

public static class Clock
{
    /// <summary>
    /// The current UTC time at millisecond precision, matching the
    /// timestamp(3) columns, so a value reads back exactly as it was written.
    /// </summary>
    public static DateTime Now()
    {
        var now = DateTime.UtcNow;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
    }

    /// <summary>ISO 8601 in UTC with milliseconds, e.g. 2026-10-08T12:00:00.000Z.</summary>
    public static string ToIso(DateTime value) =>
        value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    public static string IsoNow() => ToIso(Now());
}
