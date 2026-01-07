import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from 'src/auth/strategies';

/**
 * Parameter decorator to extract the authenticated user from the request.
 *
 * The JWT strategy attaches an AuthUser object (id, email) to request.user.
 * If you need full user data, fetch it from the database using the user ID.
 *
 * @example
 * // Get the full AuthUser object
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthUser) { ... }
 *
 * @example
 * // Get a specific property
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (data) {
      return user[data];
    }

    return user;
  },
);
