export class ContentValidationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Content validation failed with ${issues.length} issue(s).`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}