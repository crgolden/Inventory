Feature: Browsing the catalog
  The catalog lists every product anyone has added, and each one has its own page.

  Scenario: Viewing a product from the catalog
    Given the catalog holds a product I added
    When I view that product from the catalog
    Then I see that product's catalog page

  Scenario: Opening a catalog product that does not exist
    Given a catalog product that does not exist
    When I open that catalog product
    Then I am told the catalog product was not found

  Scenario: Going back to the catalog keeps my place
    Given I have scrolled down the catalog
    When I view a product and go back
    Then I am where I was in the catalog
