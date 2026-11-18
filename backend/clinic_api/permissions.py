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


class IsReceptionist(BasePermission):
    message = 'Chỉ lễ tân hoặc quản trị viên được thực hiện thao tác này.'

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and (
            request.user.is_superuser
            or request.user.groups.filter(name='Receptionist').exists()
        ))


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated
                    and not hasattr(request.user, 'doctor_profile')
                    and not request.user.is_superuser
                    and not request.user.groups.filter(name='Receptionist').exists())
