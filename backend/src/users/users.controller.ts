import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { UsersService } from './users.service'

const CreateUserSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128),
  fullName: z.string().min(1).max(64),
  role: z.enum(['DOCTOR', 'TECHNICIAN', 'NURSE', 'ADMIN', 'DIRECTOR']),
  department: z.string().max(128).optional(),
})

const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(64).optional(),
  role: z.enum(['DOCTOR', 'TECHNICIAN', 'NURSE', 'ADMIN', 'DIRECTOR']).optional(),
  department: z.string().max(128).optional(),
  active: z.boolean().optional(),
})

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.users.list(Number(skip ?? 0), Number(take ?? 20))
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.findById(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateUserSchema)) body: z.infer<typeof CreateUserSchema>) {
    return this.users.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateUserSchema)) body: z.infer<typeof UpdateUserSchema>) {
    return this.users.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.users.delete(id)
  }

  @Get(':id/activity')
  getActivity(@Param('id') id: string) {
    return this.users.getActivity(id)
  }
}
