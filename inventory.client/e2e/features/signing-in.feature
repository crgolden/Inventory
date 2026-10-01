Feature: Signing in
  An owner signs in before they can see their own products.

  Scenario: A signed-in owner is offered their products
    Given I am signed in
    When I open the home page
    Then I am offered my products
    And I am not asked to sign in

  @noauth
  Scenario: A visitor is asked to sign in
    Given I am not signed in
    When I open the home page
    Then I am asked to sign in

  @noauth
  Scenario: A visitor who tries to open their products is sent to sign in
    Given I am not signed in
    When I try to open my products
    Then I am sent to sign in
