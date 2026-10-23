import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { MeDto } from './dto/me.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { TokenPairDto } from './dto/token-pair.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({
    type: User,
    description: 'Користувач з роллю user, без пароля та хеша',
  })
  @ApiBadRequestResponse({
    description: 'Неправильний формат пошти або пароль коротший за 8 символів',
  })
  @ApiConflictResponse({ description: 'Користувач з такою поштою вже існує' })
  async register(@Body() dto: RegisterDto): Promise<User> {
    return this.authService.register(dto); // passwordHash прибирає ClassSerializerInterceptor
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK) // вхід нічого не створює → 200, а не 201
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({
    description:
      'Неправильна пошта або пароль (повідомлення однакове для обох випадків)',
  })
  async login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.authService.login(dto);
  }

  // @Public(): до refresh звертаються, коли access-токен уже протух
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: TokenPairDto,
    description: 'Нова пара; переданий refresh-токен більше не дійсний',
  })
  @ApiBadRequestResponse({ description: 'refreshToken відсутній у тілі' })
  @ApiUnauthorizedResponse({
    description:
      'Refresh-токена немає в базі, він прострочений або вже використаний',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Refresh-токен відкликано' })
  @ApiBadRequestResponse({ description: 'refreshToken відсутній у тілі' })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  @ApiNotFoundResponse({
    description: 'Refresh-токен не існує або належить іншому користувачу',
  })
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    await this.authService.logout(dto.refreshToken, userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({
    description: 'Access-токен відсутній або недійсний',
  })
  async me(@CurrentUser('sub') userId: string): Promise<MeDto> {
    const { id, email, role } = await this.usersService.findByIdOrFail(userId);
    return { id, email, role };
  }
}
