/*
 * Assert that a document fails validation on the given field.
 */
export function expectValidationError(document, path) {
  const error = document.validateSync();

  expect(error).toBeTruthy();
  expect(error.errors[path]).toBeTruthy();

  return error;
}

/*
 * Find a schema index with the exact field order and sort directions.
 */
export function findIndexByFields(schema, expectedFields) {
  const expectedEntries = Object.entries(expectedFields);

  return schema.indexes().find(([actualFields]) => {
    const actualEntries = Object.entries(actualFields);

    if (actualEntries.length !== expectedEntries.length) {
      return false;
    }

    return expectedEntries.every(([expectedKey, expectedDirection], index) => {
      const [actualKey, actualDirection] = actualEntries[index];

      return actualKey === expectedKey && actualDirection === expectedDirection;
    });
  });
}
