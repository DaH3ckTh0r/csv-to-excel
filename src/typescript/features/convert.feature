Feature: Convert CSV files to Excel
  As someone who receives data as CSV
  I want to convert it into a real Excel workbook from my terminal
  So that numbers, text and formatting come out right without manual cleanup

  Background:
    Given a working directory

  Scenario: Convert a simple CSV file
    Given a CSV file "people.csv" containing:
      """
      id,name,age
      1,Ana,34
      2,Luis,28
      """
    When I run csv2xlsx with "people.csv"
    Then the command succeeds
    And the file "people.xlsx" exists
    And sheet "Sheet1" has 3 rows and 3 columns
    And cell "B2" of sheet "Sheet1" is the text "Ana"
    And cell "C3" of sheet "Sheet1" is the number 28

  Scenario: Quoted fields with commas, quotes and line breaks are preserved
    Given a CSV file "tricky.csv" containing:
      """
      name,notes
      "Smith, John","Said ""hi""
      then left"
      """
    When I run csv2xlsx with "tricky.csv out.xlsx"
    Then the command succeeds
    And cell "A2" of sheet "Sheet1" is the text "Smith, John"
    And cell "B2" of sheet "Sheet1" is the text "Said \"hi\"\nthen left"

  Scenario: Codes with leading zeros stay as text
    Given a CSV file "zips.csv" containing:
      """
      zip,active
      00123,true
      """
    When I run csv2xlsx with "zips.csv"
    Then cell "A2" of sheet "Sheet1" is the text "00123"
    And cell "B2" of sheet "Sheet1" is the boolean true

  Scenario: Type detection can be turned off
    Given a CSV file "raw.csv" containing:
      """
      amount
      42
      """
    When I run csv2xlsx with "raw.csv --no-types"
    Then cell "A2" of sheet "Sheet1" is the text "42"

  Scenario: Semicolon-separated files are detected automatically
    Given a CSV file "es.csv" containing:
      """
      producto;precio
      café;3.5
      """
    When I run csv2xlsx with "es.csv"
    Then cell "A2" of sheet "Sheet1" is the text "café"
    And cell "B2" of sheet "Sheet1" is the number 3.5

  Scenario: Custom sheet name and Excel table
    Given a CSV file "sales.csv" containing:
      """
      region,total
      North,100
      """
    When I run csv2xlsx with "sales.csv sales.xlsx --sheet Ventas --table"
    Then the command succeeds
    And sheet "Ventas" contains an Excel table

  Scenario: A missing input file is reported clearly
    When I run csv2xlsx with "nope.csv"
    Then the command fails with exit code 1
    And the error output mentions "Cannot read file"

  Scenario: Invalid options are rejected
    Given a CSV file "people.csv" containing:
      """
      a
      """
    When I run csv2xlsx with "people.csv -d ;;"
    Then the command fails with exit code 2
    And the error output mentions "single character"
