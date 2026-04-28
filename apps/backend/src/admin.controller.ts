import { Body, Controller, Get, Put } from "@nestjs/common";
import { AdminService } from "./admin.service.js";

@Controller("api")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("settings")
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put("settings")
  saveSettings(@Body() body: unknown) {
    return this.adminService.saveSettings(body);
  }

}
