import { ExecutionContext, Injectable, ResourceDecorator as Resource } from '@nitrostack/core';
import { DatasetsService } from './datasets.service.js';

@Injectable({ deps: [DatasetsService] })
export class DatasetsResources {
  constructor(private readonly datasets: DatasetsService) {}

  @Resource({
    uri: 'seer://datasets',
    name: 'Seer datasets',
    description: 'Catalogue of the approved CSV datasets available to Seer.',
    mimeType: 'application/json',
  })
  async getCatalogue(_uri: string, _context: ExecutionContext) {
    return { datasets: await this.datasets.list() };
  }

  @Resource({
    uri: 'seer://datasets/employee-compensation',
    name: 'Employee Compensation CSV',
    description: 'Synthetic employee compensation data for eligible supervised-learning analysis.',
    mimeType: 'text/csv',
  })
  async getEmployeeCompensationCsv(_uri: string, _context: ExecutionContext) {
    return this.datasets.readCsvText('employee-compensation');
  }

  @Resource({
    uri: 'seer://datasets/employee-attrition',
    name: 'Employee Attrition CSV',
    description: 'Synthetic employee attrition data for eligible supervised-learning classification.',
    mimeType: 'text/csv',
  })
  async getEmployeeAttritionCsv(_uri: string, _context: ExecutionContext) {
    return this.datasets.readCsvText('employee-attrition');
  }
}
