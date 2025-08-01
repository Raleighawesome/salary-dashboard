export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: number;
  source: 'api' | 'fallback' | 'cache';
}

export interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateSource: 'api' | 'fallback' | 'cache';
  timestamp: number;
}

export interface CurrencyConverterOptions {
  apiKey?: string;
  cacheDurationMs?: number; // Default: 1 hour
  fallbackToStaticRates?: boolean; // Default: true
  retryAttempts?: number; // Default: 3
  timeoutMs?: number; // Default: 5000ms
}

// Static fallback rates (approximate rates as of 2024)
const FALLBACK_RATES: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.85,
  'GBP': 0.73,
  'JPY': 110.0,
  'CAD': 1.25,
  'AUD': 1.35,
  'CHF': 0.88,
  'CNY': 7.1,
  'INR': 83.0,
  'BRL': 5.2,
  'MXN': 18.0,
  'SGD': 1.32,
  'HKD': 7.8,
  'SEK': 10.5,
  'NOK': 10.8,
  'DKK': 6.9,
  'PLN': 4.1,
  'CZK': 23.0,
  'HUF': 360.0,
  'RUB': 75.0,
  'ZAR': 18.5,
  'KRW': 1300.0,
  'THB': 35.0,
  'MYR': 4.6,
  'PHP': 56.0,
  'IDR': 15500.0,
  'VND': 24000.0,
};

export class CurrencyConverter {
  private static cache = new Map<string, ExchangeRate>();
  private static options: Required<CurrencyConverterOptions> = {
    apiKey: '',
    cacheDurationMs: 60 * 60 * 1000, // 1 hour
    fallbackToStaticRates: true,
    retryAttempts: 3,
    timeoutMs: 5000,
  };

  // Initialize the converter with options
  public static initialize(options: CurrencyConverterOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
    

  }

  // Convert amount from one currency to another
  public static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<CurrencyConversionResult> {
    // Normalize currency codes
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // If same currency, no conversion needed
    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: to,
        exchangeRate: 1.0,
        rateSource: 'cache',
        timestamp: Date.now(),
      };
    }

    try {
      // Get exchange rate
      const exchangeRate = await this.getExchangeRate(from, to);
      
      // Calculate converted amount
      const convertedAmount = Math.round((amount * exchangeRate.rate) * 100) / 100;

      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount,
        targetCurrency: to,
        exchangeRate: exchangeRate.rate,
        rateSource: exchangeRate.source,
        timestamp: exchangeRate.timestamp,
      };

    } catch (error) {
      console.error(`❌ Currency conversion failed: ${from} → ${to}`, error);
      
      // Return original amount if conversion fails
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: from, // Keep original currency
        exchangeRate: 1.0,
        rateSource: 'fallback',
        timestamp: Date.now(),
      };
    }
  }

  // Get exchange rate between two currencies
  public static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<ExchangeRate> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const cacheKey = `${from}-${to}`;

    // Check cache first
    const cachedRate = await this.getCachedRate(cacheKey);
    if (cachedRate) {
      return cachedRate;
    }

    // Try to fetch from API
    try {
      const apiRate = await this.fetchFromAPI(from, to);
      if (apiRate) {
        await this.cacheRate(cacheKey, apiRate);
        return apiRate;
      }
    } catch (error) {
      console.warn(`⚠️  API fetch failed for ${from} → ${to}:`, error);
    }

    // Fall back to static rates
    if (this.options.fallbackToStaticRates) {
      const fallbackRate = this.getFallbackRate(from, to);
      if (fallbackRate) {
        await this.cacheRate(cacheKey, fallbackRate);
        return fallbackRate;
      }
    }

    throw new Error(`No exchange rate available for ${from} → ${to}`);
  }

  // Fetch exchange rate from API
  private static async fetchFromAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    // Try multiple free APIs in order of preference
    const apis = [
      () => this.fetchFromExchangeRateAPI(fromCurrency, toCurrency),
      () => this.fetchFromFixer(fromCurrency, toCurrency),
      () => this.fetchFromCurrencyAPI(fromCurrency, toCurrency),
    ];

    for (const apiCall of apis) {
      try {
        const result = await apiCall();
        if (result) {
    
          return result;
        }
      } catch (error) {
        console.warn(`⚠️  API call failed:`, error);
        continue;
      }
    }

    return null;
  }

  // Fetch from exchangerate-api.com (free tier available)
  private static async fetchFromExchangeRateAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    const url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.rates && data.rates[toCurrency]) {
        return {
          fromCurrency,
          toCurrency,
          rate: data.rates[toCurrency],
          timestamp: Date.now(),
          source: 'api',
        };
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Fetch from fixer.io (requires API key for production)
  private static async fetchFromFixer(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    if (!this.options.apiKey) {
      return null; // Skip if no API key
    }

    const url = `https://api.fixer.io/latest?access_key=${this.options.apiKey}&base=${fromCurrency}&symbols=${toCurrency}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.rates && data.rates[toCurrency]) {
        return {
          fromCurrency,
          toCurrency,
          rate: data.rates[toCurrency],
          timestamp: Date.now(),
          source: 'api',
        };
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Fetch from currencyapi.com (free tier available)
  private static async fetchFromCurrencyAPI(
    _fromCurrency: string,
    _toCurrency: string
  ): Promise<ExchangeRate | null> {
    // This would require an API key for production use
    // For now, we'll skip this implementation
    return null;
  }

  // Get fallback rate from static rates
  private static getFallbackRate(
    fromCurrency: string,
    toCurrency: string
  ): ExchangeRate | null {
    const fromRate = FALLBACK_RATES[fromCurrency];
    const toRate = FALLBACK_RATES[toCurrency];

    if (fromRate && toRate) {
      // Convert via USD: from → USD → to
      const rate = toRate / fromRate;
      

      
      return {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: Date.now(),
        source: 'fallback',
      };
    }

    return null;
  }

  // Check if we have a cached rate (memory first, then IndexedDB)
  private static async getCachedRate(cacheKey: string): Promise<ExchangeRate | null> {
    // Check memory cache first
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache) {
      const age = Date.now() - memoryCache.timestamp;
      if (age < this.options.cacheDurationMs) {
    
        return { ...memoryCache, source: 'cache' };
      } else {
        // Remove expired cache entry
        this.cache.delete(cacheKey);
      }
    }

    // Check IndexedDB cache
    try {
      const { DataStorageService } = await import('./dataStorage');
      const [fromCurrency, toCurrency] = cacheKey.split('-');
      const dbCached = await DataStorageService.getCachedCurrencyRate(fromCurrency, toCurrency);
      
      if (dbCached) {
        // Also cache in memory for faster access
        this.cache.set(cacheKey, dbCached);
        return dbCached;
      }
    } catch (error) {
      console.warn('Failed to check IndexedDB currency cache:', error);
    }

    return null;
  }

  // Cache an exchange rate (both memory and IndexedDB)
  private static async cacheRate(cacheKey: string, rate: ExchangeRate): Promise<void> {
    // Cache in memory
    this.cache.set(cacheKey, rate);


    // Cache in IndexedDB for persistence
    try {
      const { DataStorageService } = await import('./dataStorage');
      await DataStorageService.cacheCurrencyRate(rate, this.options.cacheDurationMs);
    } catch (error) {
      console.warn('Failed to cache currency rate in IndexedDB:', error);
    }
  }

  // Convert multiple amounts in batch
  public static async convertBatch(
    conversions: Array<{
      amount: number;
      fromCurrency: string;
      toCurrency?: string;
      id?: string;
    }>
  ): Promise<Array<CurrencyConversionResult & { id?: string }>> {
    const results = await Promise.allSettled(
      conversions.map(async (conversion) => {
        const result = await this.convertCurrency(
          conversion.amount,
          conversion.fromCurrency,
          conversion.toCurrency
        );
        return { ...result, id: conversion.id };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Batch conversion failed for item ${index}:`, result.reason);
        // Return fallback result
        const conversion = conversions[index];
        return {
          originalAmount: conversion.amount,
          originalCurrency: conversion.fromCurrency,
          convertedAmount: conversion.amount,
          targetCurrency: conversion.fromCurrency,
          exchangeRate: 1.0,
          rateSource: 'fallback' as const,
          timestamp: Date.now(),
          id: conversion.id,
        };
      }
    });
  }

  // Get supported currencies
  public static getSupportedCurrencies(): string[] {
    return Object.keys(FALLBACK_RATES).sort();
  }

  // Check if a currency is supported
  public static isCurrencySupported(currency: string): boolean {
    return currency.toUpperCase() in FALLBACK_RATES;
  }

  // Clear cache
  public static clearCache(): void {
    this.cache.clear();

  }

  // Get cache statistics
  public static getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number; source: string }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, rate]) => ({
      key,
      age: Date.now() - rate.timestamp,
      source: rate.source,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  // Format currency amount for display
  public static formatCurrency(
    amount: number,
    currency: string,
    locale: string = 'en-US'
  ): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (error) {
      // Fallback formatting if currency is not supported by Intl
      return `${currency.toUpperCase()} ${amount.toLocaleString()}`;
    }
  }

  // Get exchange rate trend (if we had historical data)
  public static async getRateTrend(
    _fromCurrency: string,
    _toCurrency: string,
    _days: number = 30
  ): Promise<Array<{ date: string; rate: number }>> {
    // This would require a historical data API
    // For now, return empty array
    console.warn('📈 Rate trend data not available - would require historical API');
    return [];
  }
} 