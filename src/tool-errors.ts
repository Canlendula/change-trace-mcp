type OperationFailedResult = {
  content: [{ type: "text"; text: string }];
  isError: true;
};

export function operationFailed(error: string): OperationFailedResult {
  const result = { error, code: "operation_failed" };
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    isError: true,
  };
}
