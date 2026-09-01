namespace Inventory.Tests.E2E;

using Inventory.Tests.E2E.Infrastructure;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class ProductCrudTests
{
    private readonly PlaywrightFixture _fixture;

    public ProductCrudTests(PlaywrightFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Products_list_shows_seeded_products()
    {
        _fixture.ProductStore.Clear();
        _fixture.ProductStore.Create("LG OLED C3", 1299.99m, brand: "LG", category: "Electronics");
        _fixture.ProductStore.Create("Dyson V15", brand: "Dyson");

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("[id^='product-row-']")).ToHaveCountAsync(2);

            await Assertions.Expect(page.Locator("#products-table")).ToContainTextAsync("LG OLED C3");
        }
    }

    [Fact]
    public async Task Products_list_shows_empty_state_when_no_products()
    {
        _fixture.ProductStore.Clear();

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#products-empty-state")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("[id^='product-row-']")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task Search_filters_products_by_name()
    {
        _fixture.ProductStore.Clear();
        _fixture.ProductStore.Create("LG OLED TV");
        _fixture.ProductStore.Create("Dyson Vacuum");

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.RunAndWaitForResponseAsync(
                () => page.FillAsync("#product-search", "dyson"),
                response => response.Url.Contains("$filter=", StringComparison.Ordinal));

            await Assertions.Expect(page.Locator("[id^='product-row-']")).ToHaveCountAsync(1);
            await Assertions.Expect(page.Locator("#product-row-0")).ToContainTextAsync("Dyson Vacuum");
        }
    }

    [Fact]
    public async Task Search_shows_no_match_message_when_term_has_no_results()
    {
        _fixture.ProductStore.Clear();
        _fixture.ProductStore.Create("LG OLED TV");

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.RunAndWaitForResponseAsync(
                () => page.FillAsync("#product-search", "zzznomatch"),
                response => response.Url.Contains("$filter=", StringComparison.Ordinal));

            await Assertions.Expect(page.Locator("#products-empty-state")).ToContainTextAsync("zzznomatch");
        }
    }

    [Fact]
    [Trait("Category", "Critical")]
    public async Task Create_product_navigates_to_detail_on_success()
    {
        _fixture.ProductStore.Clear();

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.ClickAsync("#new-product-link");
            await page.WaitForURLAsync("**/products/new");

            await page.FillAsync("#name", "My Laptop");
            await page.FillAsync("#brand", "Dell");
            await page.FillAsync("#price", "999");

            await page.ClickAsync("#product-form-submit");

            await page.WaitForURLAsync(url => url.Contains("/products/", StringComparison.Ordinal) && !url.Contains("/new", StringComparison.Ordinal));

            await Assertions.Expect(page.Locator("#product-detail-heading")).ToHaveTextAsync("My Laptop");
        }
    }

    [Fact]
    [Trait("Category", "Critical")]
    public async Task Edit_product_updates_name_and_returns_to_detail()
    {
        _fixture.ProductStore.Clear();
        var product = _fixture.ProductStore.Create("Original Name", brand: "ACME");

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.GotoAsync($"/products/{product.Id}/edit");
            await page.WaitForURLAsync($"**/products/{product.Id}/edit");

            var nameInput = page.Locator("#name");
            await nameInput.ClearAsync();
            await nameInput.FillAsync("Updated Name");

            await page.ClickAsync("#product-form-submit");

            await Assertions.Expect(page).ToHaveURLAsync(new System.Text.RegularExpressions.Regex($@"/products/{product.Id}$"));

            await Assertions.Expect(page.Locator("#product-detail-heading")).ToHaveTextAsync("Updated Name");
        }
    }

    [Fact]
    [Trait("Category", "Critical")]
    public async Task Delete_product_removes_it_from_the_list()
    {
        _fixture.ProductStore.Clear();
        _fixture.ProductStore.Create("Product To Delete");
        _fixture.ProductStore.Create("Product To Keep");

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.ClickAsync("#delete-product-0");

            await page.ClickAsync("#confirm-delete-product-0");

            await Assertions.Expect(page.Locator("[id^='product-row-']")).ToHaveCountAsync(1);
        }
    }

    [Fact]
    public async Task Navigating_to_unknown_product_id_shows_not_found_page()
    {
        _fixture.ProductStore.Clear();

        var (ctx, page) = await _fixture.NewProductsPageAsync();
        await using (ctx)
        {
            await page.GotoAsync("/products/00000000-0000-0000-0000-000000000000");

            await page.WaitForURLAsync("**/products/not-found");
            await Assertions.Expect(page.Locator("#product-not-found-heading")).ToContainTextAsync("Product Not Found");
        }
    }
}