namespace Inventory.Tests.E2E;

using Inventory.Tests.E2E.Infrastructure;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class CatalogTests
{
    private const int ProductsFillingTheFirstPage = 20;
    private const int ViewportWidthPixels = 1280;
    private const int ShortViewportHeightPixels = 400;
    private const int ScrollDistancePixels = 200;
    private const int ScrollRestorationTolerancePixels = 5;

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
            await page.RunAndWaitForResponseAsync(
                () => page.FillAsync("#catalog-search", "dyson"),
                response => response.Url.Contains("$filter=", StringComparison.Ordinal));

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
            await page.RunAndWaitForResponseAsync(
                () => page.FillAsync("#catalog-search", "zzznomatch"),
                response => response.Url.Contains("$filter=", StringComparison.Ordinal));

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

            await page.RunAndWaitForResponseAsync(
                () => page.ClickAsync("#sort-by-name"),
                response => response.Url.Contains("$orderby=", StringComparison.Ordinal));

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
            ).ToHaveTextAsync(productName);

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
            ).ToBeVisibleAsync();
            Assert.Contains("/catalog/not-found", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Back_from_a_product_returns_the_reader_to_where_they_were_in_the_list()
    {
        _fixture.CatalogStore.Clear();
        for (var seeded = 0; seeded < ProductsFillingTheFirstPage; seeded++)
        {
            _fixture.CatalogStore.Create($"{Guid.NewGuid()}");
        }

        var (ctx, page) = await _fixture.NewCatalogPageAsync();
        await using (ctx)
        {
            await page.SetViewportSizeAsync(ViewportWidthPixels, ShortViewportHeightPixels);
            await Assertions.Expect(page.Locator("#catalog-row-0")).ToBeVisibleAsync();

            var readerPosition = await page.EvaluateAsync<int>(
                "distance => { window.scrollBy(0, distance); return Math.round(window.scrollY); }",
                ScrollDistancePixels);
            Assert.True(
                readerPosition > 0,
                "the catalog page did not overflow the shortened viewport, so this test cannot tell a "
                    + $"restored position from a reset one (scrollY {readerPosition})");

            var positionWhenLeaving = await page.EvaluateAsync<int>(
                """
                () => {
                  const link = [...document.querySelectorAll('[id^="view-product-"]')].find((anchor) => {
                    const box = anchor.getBoundingClientRect();
                    return box.top >= 0 && box.bottom <= window.innerHeight;
                  });
                  link.click();
                  return Math.round(window.scrollY);
                }
                """);
            Assert.Equal(readerPosition, positionWhenLeaving);

            await Assertions.Expect(page.Locator("#catalog-detail-heading")).ToBeVisibleAsync();
            await page.GoBackAsync();
            await Assertions.Expect(page.Locator("#catalog-table")).ToBeVisibleAsync();

            await page.WaitForFunctionAsync(
                $"expected => Math.abs(window.scrollY - expected) <= {ScrollRestorationTolerancePixels}",
                readerPosition);
        }
    }
}