namespace Inventory.Tests.E2E;

using Inventory.Tests.E2E.Infrastructure;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class CatalogTests
{
    private readonly PlaywrightFixture _fixture;

    public CatalogTests(PlaywrightFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Catalog_shows_all_seeded_products()
    {
        _fixture.CatalogStore.Clear();
        _fixture.CatalogStore.Create("LG OLED TV", price: 1299.99m, brand: "LG", category: "Electronics");
        _fixture.CatalogStore.Create("Dyson V15", price: 499.99m, brand: "Dyson", category: "Home");

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("[id^='catalog-row-']")).ToHaveCountAsync(2);
            await Assertions.Expect(page.Locator("#catalog-table")).ToContainTextAsync("LG OLED TV");
        }
    }

    [Fact]
    public async Task Catalog_shows_empty_state_when_no_products()
    {
        _fixture.CatalogStore.Clear();

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#catalog-empty-state")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("[id^='catalog-row-']")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task Catalog_search_filters_by_name()
    {
        _fixture.CatalogStore.Clear();
        _fixture.CatalogStore.Create("LG OLED TV");
        _fixture.CatalogStore.Create("Dyson Vacuum");

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            var searchInput = page.Locator("#catalog-search");
            await searchInput.FillAsync("dyson");

            await Task.Delay(400, TestContext.Current.CancellationToken);
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            await Assertions.Expect(page.Locator("[id^='catalog-row-']")).ToHaveCountAsync(1);
            await Assertions.Expect(page.Locator("#catalog-row-0")).ToContainTextAsync("Dyson Vacuum");
        }
    }

    [Fact]
    public async Task Catalog_search_shows_no_match_message_when_no_results()
    {
        _fixture.CatalogStore.Clear();
        _fixture.CatalogStore.Create("LG OLED TV");

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            var searchInput = page.Locator("#catalog-search");
            await searchInput.FillAsync("zzznomatch");

            await Task.Delay(400, TestContext.Current.CancellationToken);
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            await Assertions.Expect(page.Locator("#catalog-empty-state")).ToContainTextAsync("zzznomatch");
        }
    }

    [Fact]
    public async Task Catalog_sorts_by_name_descending_when_Name_header_clicked()
    {
        _fixture.CatalogStore.Clear();
        _fixture.CatalogStore.Create("Zebra Printer", brand: "Zebra");
        _fixture.CatalogStore.Create("Apple TV", brand: "Apple");

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            var firstRow = page.Locator("#catalog-row-0");

            await Assertions.Expect(firstRow).ToContainTextAsync("Apple TV");

            await page.ClickAsync("#sort-by-name");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            await Assertions.Expect(firstRow).ToContainTextAsync("Zebra Printer");
        }
    }

    [Fact]
    [Trait("Category", "Critical")]
    public async Task Catalog_navigates_to_detail_page_when_View_clicked()
    {
        _fixture.CatalogStore.Clear();
        var productName = $"Sony OLED TV {Guid.NewGuid():N}";
        var product = _fixture.CatalogStore.Create(productName, brand: "Sony");

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            await page.ClickAsync("#view-product-0");

            await Assertions.Expect(
                page.Locator("#catalog-detail-heading")
            ).ToHaveTextAsync(productName, new LocatorAssertionsToHaveTextOptions { Timeout = 60_000 });

            Assert.Contains($"/catalog/{product.Id}", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Catalog_detail_shows_not_found_for_unknown_product_id()
    {
        _fixture.CatalogStore.Clear();

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            await page.GotoAsync("/catalog/00000000-0000-0000-0000-000000000000");

            await Assertions.Expect(
                page.Locator("#catalog-not-found-heading")
            ).ToBeVisibleAsync(new LocatorAssertionsToBeVisibleOptions { Timeout = 60_000 });
            Assert.Contains("/catalog/not-found", page.Url, StringComparison.Ordinal);
        }
    }
}