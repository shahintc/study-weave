export function parse(llmResponse) {
  const result = {
    options: [],
    criteria: []
  };

  const MAX_ALLOWED_INDEX = 10000;

  // Ensure llmResponse is treated as a string, handling null/undefined gracefully
  const responseString = String(llmResponse || '');

  // Split the response by delimiters like "A:1:" or "C:2:", keeping the delimiters in the result.
  // The regex `(\s*[AC]:\d+:)` captures the delimiters, allowing for optional leading whitespace.
  const parts = responseString.split(/(\s*[AC]:\d+:)/);

  let i = 0;
  while (i < parts.length) {
    const segment = parts[i];

    // If the segment is empty or just whitespace, skip it.
    if (segment.trim().length === 0) {
      i++;
      continue;
    }

    // Attempt to match the current segment as a delimiter (e.g., "A:1:", "C:2:").
    // The regex `^\s*([AC]):(\d+):$` is strict to ensure we're matching only a delimiter.
    const delimiterMatch = segment.match(/^\s*([AC]):(\d+):$/);

    if (delimiterMatch) {
      const type = delimiterMatch[1];
      const index = parseInt(delimiterMatch[2], 10) - 1; // Convert to 0-based index

      // Check for negative or excessively large indices
      if (index < 0 || index > MAX_ALLOWED_INDEX) {
        console.error(`RangeError: Index ${index + 1} is out of acceptable bounds (1-${MAX_ALLOWED_INDEX + 1}). Skipping block related to: "${segment}"`);
        // If the index is invalid, we skip this delimiter and its potential content.
        // The content would be the *next* segment in the `parts` array.
        i += 2; // Advance `i` past both the delimiter and its content
        continue;
      }

      // The content for this delimiter is expected in the next segment of the `parts` array.
      let rawValue = "";
      if (i + 1 < parts.length) {
        // Get the content segment and trim any leading/trailing whitespace.
        // Newlines are considered whitespace and should be trimmed from the ends.
        rawValue = parts[i + 1].trim();
        i++; // Increment `i` to consume this content segment, so it's not processed again.
      }
      
      // Now, i is at the content segment. We will increment it again after processing.

      // Attempt to parse the rawValue as an integer.
      // Use a strict check to ensure the content is *only* a number, not text starting with a number.
      const parsedValue = parseInt(rawValue, 10);
      const isPureNumber = !isNaN(parsedValue) && String(parsedValue) === rawValue;

      if (type === 'A') {
        if (isPureNumber) {
          result.options[index] = parsedValue;
        } else {
          // If not a pure number, store the content as a string
          result.options[index] = rawValue;
        }
      } else if (type === 'C') {
        // Criteria (C) type strictly expects a number
        if (isPureNumber) {
          result.criteria[index] = parsedValue;
        } else {
          console.warn(`Warning: Criteria (C) type expected a number for index ${index + 1} but received text: "${rawValue}". Skipping this entry.`);
        }
      }
    } else {
      // This segment is not a recognized delimiter.
      // It could be initial text before any A:x: or C:x: blocks, or malformed content.
      console.warn(`Warning: Found unparseable content segment: "${segment}". Skipping.`);
    }
    i++; // Move to the next segment in `parts`
  }

  return result;
}