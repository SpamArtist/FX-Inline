import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";

type RequestLike = {
  method: string;
  path: string;
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  json: (payload: unknown) => void;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestLike>();
    const response = ctx.getResponse<ResponseLike>();

    let statusCode = 500;
    let message = "Unexpected error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      message = extractMessage(exception.getResponse()) || exception.message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (message === "Unauthorized") {
      statusCode = 401;
    } else if (message === "Forbidden") {
      statusCode = 403;
    } else if (!(exception instanceof HttpException)) {
      if (request.method === "POST" && request.path.startsWith("/auth")) {
        statusCode = 400;
      }
    }

    if (statusCode === 404) {
      message = "Not found";
    }

    response.status(statusCode).json({ error: message });
  }
}

function extractMessage(response: string | object): string | null {
  if (typeof response === "string") {
    return response;
  }

  if (response && typeof response === "object" && "message" in response) {
    const value = (response as { message?: unknown }).message;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(", ");
  }

  return null;
}
