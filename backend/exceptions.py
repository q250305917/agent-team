"""自定义异常类和异常处理器

定义业务相关的自定义异常，以及全局异常处理器。
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging
import traceback
import uuid

from schemas import ApiErrorResponse, ErrorDetail

logger = logging.getLogger(__name__)


# ============================================================
# 自定义异常类
# ============================================================


class TeamNotFoundException(Exception):
    """团队不存在异常"""

    def __init__(self, team_name: str):
        self.team_name = team_name
        super().__init__(f"团队 '{team_name}' 不存在")


class ResourceNotFoundException(Exception):
    """资源不存在异常"""

    def __init__(self, resource: str, identifier: str):
        self.resource = resource
        self.identifier = identifier
        super().__init__(f"{resource} '{identifier}' 不存在")


class ValidationException(Exception):
    """数据验证异常"""

    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


# ============================================================
# 异常处理器
# ============================================================


async def team_not_found_handler(request: Request, exc: TeamNotFoundException) -> JSONResponse:
    """处理团队不存在异常"""
    error = ErrorDetail(
        code="TEAM_NOT_FOUND",
        message=f"团队 '{exc.team_name}' 不存在",
        details={"team_name": exc.team_name}
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


async def resource_not_found_handler(request: Request, exc: ResourceNotFoundException) -> JSONResponse:
    """处理资源不存在异常"""
    error = ErrorDetail(
        code="RESOURCE_NOT_FOUND",
        message=f"{exc.resource} '{exc.identifier}' 不存在",
        details={"resource": exc.resource, "identifier": exc.identifier}
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


async def validation_exception_handler(request: Request, exc: ValidationException) -> JSONResponse:
    """处理数据验证异常"""
    error = ErrorDetail(
        code="VALIDATION_ERROR",
        message=exc.message,
        details=exc.details
    )
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """处理请求参数验证错误"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })

    error = ErrorDetail(
        code="REQUEST_VALIDATION_ERROR",
        message="请求参数验证失败",
        details={"errors": errors}
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """处理数据库错误"""
    logger.error(f"数据库错误: {exc}\n{traceback.format_exc()}")

    error = ErrorDetail(
        code="DATABASE_ERROR",
        message="数据库操作失败，请稍后重试"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """处理所有未捕获的异常"""
    logger.error(f"未处理的异常: {exc}\n{traceback.format_exc()}")

    error = ErrorDetail(
        code="INTERNAL_SERVER_ERROR",
        message="服务器内部错误，请稍后重试"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ApiErrorResponse(error=error, request_id=request.state.request_id).model_dump()
    )


# ============================================================
# 异常处理器注册
# ============================================================


def register_exception_handlers(app: FastAPI):
    """注册全局异常处理器"""

    app.add_exception_handler(TeamNotFoundException, team_not_found_handler)
    app.add_exception_handler(ResourceNotFoundException, resource_not_found_handler)
    app.add_exception_handler(ValidationException, validation_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(SQLAlchemyError, database_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)


def add_request_id_middleware(app: FastAPI):
    """添加请求 ID 中间件，为每个请求生成唯一 ID"""

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
