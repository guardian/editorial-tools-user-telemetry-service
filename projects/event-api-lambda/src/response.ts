interface IResponse {
  status: 'ok' | 'error';
  message?: string;
  data?: Object
}

export const createErrorResponse = (message: string, data: Object): IResponse => ({
  status: 'error',
  message,
  data
});

export const createOkResponse = (): IResponse => ({
  status: 'ok'
})
