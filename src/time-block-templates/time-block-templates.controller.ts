import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TimeBlockTemplatesService } from './time-block-templates.service';
import {
  CreateTimeBlockTemplateDto,
  UpdateTimeBlockTemplateDto,
  DeactivateTemplateDto,
} from './dto';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Time Block Templates')
@ApiBearerAuth()
@Controller('time-block-templates')
@UseGuards(JwtAuthGuard)
export class TimeBlockTemplatesController {
  constructor(private templatesService: TimeBlockTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all time block templates for the user' })
  @ApiResponse({ status: 200, description: 'Returns all templates with notes' })
  findAll(@CurrentUser('id') userId: string) {
    return this.templatesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single time block template by ID' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Returns template with notes' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.templatesService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new recurring time block template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTimeBlockTemplateDto,
  ) {
    return this.templatesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a time block template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTimeBlockTemplateDto,
  ) {
    return this.templatesService.update(id, userId, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a template (stop recurring)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template deactivated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DeactivateTemplateDto,
  ) {
    return this.templatesService.deactivate(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time block template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.templatesService.remove(id, userId);
  }
}
