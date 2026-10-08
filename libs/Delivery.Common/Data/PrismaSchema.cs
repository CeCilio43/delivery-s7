using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace Delivery.Common.Data;

/// <summary>
/// Maps EF Core models onto the tables Prisma created: tables named after
/// the model ("Order"), camelCase columns ("customerId"), timestamp(3)
/// columns holding UTC, and Postgres enums with UPPER_SNAKE_CASE labels.
/// </summary>
public static class PrismaSchema
{
    // Npgsql refuses UTC DateTimes for "timestamp without time zone", which is
    // what Prisma's DateTime columns are. Values are stored as UTC without a
    // kind and come back marked as UTC.
    private static readonly ValueConverter<DateTime, DateTime> UtcTimestamp = new(
        value => DateTime.SpecifyKind(value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

    public static ModelBuilder UsePrismaNaming(this ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            entity.SetTableName(entity.ClrType.Name);

            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(JsonNamingPolicy.CamelCase.ConvertName(property.Name));

                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(UtcTimestamp);
                    property.SetColumnType("timestamp(3)");
                }
            }
        }
        return modelBuilder;
    }

    /// <summary>Maps a C# enum onto the Postgres enum type Prisma created for it.</summary>
    public static NpgsqlDbContextOptionsBuilder MapPrismaEnum<TEnum>(this NpgsqlDbContextOptionsBuilder options)
        where TEnum : struct, Enum =>
        options.MapEnum<TEnum>(typeof(TEnum).Name, nameTranslator: UpperSnakeCaseTranslator.Instance);

    private sealed class UpperSnakeCaseTranslator : INpgsqlNameTranslator
    {
        public static readonly UpperSnakeCaseTranslator Instance = new();

        public string TranslateTypeName(string clrName) => clrName;

        public string TranslateMemberName(string clrName) => JsonNamingPolicy.SnakeCaseUpper.ConvertName(clrName);
    }
}
