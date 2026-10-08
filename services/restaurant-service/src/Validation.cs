using System.Globalization;
using System.Text.Json.Nodes;
using Delivery.Common.Http;
using RestaurantService.Data;

namespace RestaurantService;

/// <summary>
/// Request-body parsing for the owner endpoints. Each parser returns a
/// client-facing error message, or null with the cleaned-up data in its out
/// parameter.
/// </summary>
public static class Validation
{
    private const int MaxNameLength = 100;
    private const int MaxTextLength = 500;
    private const decimal MaxPrice = 10000;

    private const string NotAnObject = "Request body must be a JSON object";

    public record RestaurantInput(string Name, string Address, string? Cuisine, string? Description);

    public record MenuItemInput(string Name, string? Description, decimal Price, bool IsAvailable);

    public static string? ParseNewRestaurant(JsonNode? body, out RestaurantInput input)
    {
        input = null!;
        if (body is not JsonObject fields) return NotAnObject;
        if (RequiredText(fields["name"], "name", MaxNameLength, out var name) is { } nameError) return nameError;
        if (RequiredText(fields["address"], "address", MaxTextLength, out var address) is { } addressError) return addressError;
        if (OptionalText(fields["cuisine"], "cuisine", MaxNameLength, out var cuisine) is { } cuisineError) return cuisineError;
        if (OptionalText(fields["description"], "description", MaxTextLength, out var description) is { } descriptionError) return descriptionError;

        input = new RestaurantInput(name, address, cuisine, description);
        return null;
    }

    /// <summary>Only the fields present in the body are updated.</summary>
    public static string? ParseRestaurantUpdate(JsonNode? body, out Action<Restaurant> apply)
    {
        apply = _ => { };
        if (body is not JsonObject fields) return NotAnObject;
        var changes = new List<Action<Restaurant>>();

        if (fields.ContainsKey("name"))
        {
            if (RequiredText(fields["name"], "name", MaxNameLength, out var name) is { } error) return error;
            changes.Add(r => r.Name = name);
        }
        if (fields.ContainsKey("address"))
        {
            if (RequiredText(fields["address"], "address", MaxTextLength, out var address) is { } error) return error;
            changes.Add(r => r.Address = address);
        }
        if (fields.ContainsKey("cuisine"))
        {
            if (OptionalText(fields["cuisine"], "cuisine", MaxNameLength, out var cuisine) is { } error) return error;
            changes.Add(r => r.Cuisine = cuisine);
        }
        if (fields.ContainsKey("description"))
        {
            if (OptionalText(fields["description"], "description", MaxTextLength, out var description) is { } error) return error;
            changes.Add(r => r.Description = description);
        }
        if (fields.ContainsKey("isOpen"))
        {
            if (Boolean(fields["isOpen"], "isOpen", out var isOpen) is { } error) return error;
            changes.Add(r => r.IsOpen = isOpen);
        }

        if (changes.Count == 0) return "Nothing to update";
        apply = restaurant => changes.ForEach(change => change(restaurant));
        return null;
    }

    public static string? ParseNewMenuItem(JsonNode? body, out MenuItemInput input)
    {
        input = null!;
        if (body is not JsonObject fields) return NotAnObject;
        if (RequiredText(fields["name"], "name", MaxNameLength, out var name) is { } nameError) return nameError;
        if (OptionalText(fields["description"], "description", MaxTextLength, out var description) is { } descriptionError) return descriptionError;
        if (Price(fields["price"], out var price) is { } priceError) return priceError;

        var isAvailable = true;
        if (fields.ContainsKey("isAvailable") && Boolean(fields["isAvailable"], "isAvailable", out isAvailable) is { } availableError)
        {
            return availableError;
        }

        input = new MenuItemInput(name, description, price, isAvailable);
        return null;
    }

    /// <summary>Only the fields present in the body are updated.</summary>
    public static string? ParseMenuItemUpdate(JsonNode? body, out Action<MenuItem> apply)
    {
        apply = _ => { };
        if (body is not JsonObject fields) return NotAnObject;
        var changes = new List<Action<MenuItem>>();

        if (fields.ContainsKey("name"))
        {
            if (RequiredText(fields["name"], "name", MaxNameLength, out var name) is { } error) return error;
            changes.Add(i => i.Name = name);
        }
        if (fields.ContainsKey("description"))
        {
            if (OptionalText(fields["description"], "description", MaxTextLength, out var description) is { } error) return error;
            changes.Add(i => i.Description = description);
        }
        if (fields.ContainsKey("price"))
        {
            if (Price(fields["price"], out var price) is { } error) return error;
            changes.Add(i => i.Price = price);
        }
        if (fields.ContainsKey("isAvailable"))
        {
            if (Boolean(fields["isAvailable"], "isAvailable", out var isAvailable) is { } error) return error;
            changes.Add(i => i.IsAvailable = isAvailable);
        }

        if (changes.Count == 0) return "Nothing to update";
        apply = item => changes.ForEach(change => change(item));
        return null;
    }

    private static string? RequiredText(JsonNode? node, string field, int max, out string value)
    {
        value = node.AsString()?.Trim() ?? "";
        if (value.Length == 0) return $"{field} is required";
        if (value.Length > max) return $"{field} must be at most {max} characters";
        return null;
    }

    // Leaving the field out, null and an empty string all mean "no value".
    private static string? OptionalText(JsonNode? node, string field, int max, out string? value)
    {
        value = null;
        if (node is null || node.AsString() == "") return null;
        if (node.AsString() is not { } text) return $"{field} must be a string";
        var trimmed = text.Trim();
        if (trimmed.Length > max) return $"{field} must be at most {max} characters";
        value = trimmed.Length == 0 ? null : trimmed;
        return null;
    }

    private static string? Price(JsonNode? node, out decimal value)
    {
        value = 0;
        decimal? number = node.AsString() is { } text && text.Trim().Length > 0
            ? decimal.TryParse(text.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : null
            : node.AsDecimal();

        if (number is not { } price || price <= 0 || price > MaxPrice)
        {
            return $"price must be a number between 0 and {MaxPrice}";
        }
        if (decimal.Round(price, 2) != price) return "price can have at most 2 decimals";

        value = price;
        return null;
    }

    private static string? Boolean(JsonNode? node, string field, out bool value)
    {
        value = node.AsBoolean() ?? false;
        return node.AsBoolean() is null ? $"{field} must be true or false" : null;
    }
}
