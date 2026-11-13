from rest_framework.permissions import BasePermission


class IsDoctor(BasePermission):
    """Chỉ cho phép người dùng đã đăng nhập và có hồ sơ Bác sĩ (doctor_profile)."""

    message = 'Bạn không có quyền truy cập chức năng dành cho Bác sĩ.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'doctor_profile')
        )
