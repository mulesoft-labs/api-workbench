/**
 * Returns whether the current text matches RAML unit.
 * @param contents
 * @returns {RegExpMatchArray}
 */
export function isRAMLUnit(contents: string) {
    return contents.match(/^(\s*#%RAML\s+(\d\.\d)\s*(\w*)\s*)|(swagger.*)$/m);
}