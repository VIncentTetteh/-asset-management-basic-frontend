import api from "@/lib/axios";

export interface ExchangeRateDto {
  id?: string;
  baseCurrency?: string;
  targetCurrency?: string;
  rate?: number;
  effectiveDate?: string;
  source?: string;
  organisationId?: string;
}

export const exchangeRateService = {
  /** POST /exchange-rates — Create a new exchange rate entry. */
  create: async (dto: Partial<ExchangeRateDto>): Promise<ExchangeRateDto> => {
    const response = await api.post<ExchangeRateDto>("/exchange-rates", dto);
    return response.data;
  },

  /** GET /exchange-rates/{id} */
  getById: async (id: string): Promise<ExchangeRateDto> => {
    const response = await api.get<ExchangeRateDto>(`/exchange-rates/${id}`);
    return response.data;
  },

  /** GET /exchange-rates — All exchange rates for the current org. */
  listAll: async (): Promise<ExchangeRateDto[]> => {
    const response = await api.get<ExchangeRateDto[]>("/exchange-rates");
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * GET /exchange-rates/convert — Convert an amount between two currencies.
   * @param amount   Source amount
   * @param from     Source currency code (e.g. "USD")
   * @param to       Target currency code (e.g. "EUR")
   * @param asOf     Optional ISO date string for historical rates
   */
  convert: async (
    amount: number,
    from: string,
    to: string,
    asOf?: string
  ): Promise<number> => {
    const params: Record<string, string | number> = { amount, from, to };
    if (asOf) params.asOf = asOf;
    const response = await api.get<number>("/exchange-rates/convert", {
      params,
    });
    return response.data;
  },

  /** DELETE /exchange-rates/{id} */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/exchange-rates/${id}`);
  },
};
