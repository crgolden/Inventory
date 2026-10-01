Feature: Managing my products
  An owner keeps a private list of the products they own.

  Scenario: My products are listed
    Given I own a product
    When I open my products
    Then I see that product in my list

  Scenario: An owner with no products is told so
    Given I own no products
    When I open my products
    Then I am told I have no products

  Scenario: Adding a product
    Given I am adding a product
    When I save a new product
    Then I see that product's page
    And I see that product in my list

  Scenario: Viewing one of my products
    Given I own a product
    When I view that product from my list
    Then I see that product's page

  Scenario: Renaming a product
    Given I own a product
    When I rename that product
    Then I see that product's page
    And I see that product in my list under its new name

  Scenario: Deleting a product
    Given I own a product
    When I delete that product from my list
    Then that product is no longer in my list

  Scenario: Opening a product that does not exist
    Given a product that does not exist
    When I open that product
    Then I am told the product was not found

  Scenario: Finding a product's manual
    Given I own a product
    When I choose to find that product's manual
    Then I see the manual finder beside that product's details
