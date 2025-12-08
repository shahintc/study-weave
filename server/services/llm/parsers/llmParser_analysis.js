export function parse(llmResponse) {
  const result = {
    options: [],
    criteria: []
  };

  // Max index check to prevent memory exhaustion
  const MAX_ALLOWED_INDEX = 10000;

  const regex = /([AC]):(\d+):(\d+)/g;
  const matches = llmResponse.matchAll(regex);

  for (const match of matches) {
    try {
      const type = match[1];
      const index = parseInt(match[2], 10) - 1;
      const value = parseInt(match[3], 10);

      // Check for negative index or excessively large index
      if (index < 0 || index > MAX_ALLOWED_INDEX) {
        throw new RangeError(`Index ${index + 1} is out of acceptable bounds (1-${MAX_ALLOWED_INDEX + 1}).`);
      }

      if (type === 'A') {
        result.options[index] = value;
      } else if (type === 'C') {
        result.criteria[index] = value;
      }

    } catch (error) {
      console.error("Failed to parse block:", match[0], "| Error:", error.message);
      // Skip this specific entry and continue parsing the rest of the string
      continue;
    }
  }

  return result;
}
