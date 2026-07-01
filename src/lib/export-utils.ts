/**
 * Export Utilities
 * Functions for exporting data to CSV and Excel formats
 */

/**
 * Export usage data to CSV format
 * @param data - Usage log data
 * @param filename - Output filename (without extension)
 */
export async function exportUsageDataToCSV(data: any[], filename: string): Promise<void> {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Define CSV headers
  const headers = [
    'Date/Time',
    'Provider',
    'Service',
    'Status',
    'Response Time (ms)',
    'Cost ($)',
    'Request ID',
    'Error Message',
  ];

  // Convert data to CSV rows
  const rows = data.map((log) => {
    const date = new Date(log.created_at).toLocaleString();
    const provider = log.provider_name || log.provider_id;
    const service = log.service_name || log.service_key || 'N/A';
    const status = log.status === 'success' ? 'Success' : 'Error';
    const responseTime = log.response_time || 0;
    const cost = (log.cost || 0).toFixed(6);
    const requestId = log.request_id || log.id;
    const errorMessage = log.error_message || '';

    return [
      date,
      provider,
      service,
      status,
      responseTime,
      cost,
      requestId,
      errorMessage,
    ];
  });

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // Download CSV file
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export usage data to Excel format
 * @param data - Usage log data
 * @param filename - Output filename (without extension)
 */
export async function exportUsageDataToExcel(data: any[], filename: string): Promise<void> {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // For Excel, we'll create a TSV (tab-separated values) file which Excel opens well
  // Define headers
  const headers = [
    'Date/Time',
    'Provider',
    'Service',
    'Status',
    'Response Time (ms)',
    'Cost ($)',
    'Request ID',
    'Error Message',
  ];

  // Convert data to TSV rows
  const rows = data.map((log) => {
    const date = new Date(log.created_at).toLocaleString();
    const provider = log.provider_name || log.provider_id;
    const service = log.service_name || log.service_key || 'N/A';
    const status = log.status === 'success' ? 'Success' : 'Error';
    const responseTime = log.response_time || 0;
    const cost = (log.cost || 0).toFixed(6);
    const requestId = log.request_id || log.id;
    const errorMessage = log.error_message || '';

    return [
      date,
      provider,
      service,
      status,
      responseTime,
      cost,
      requestId,
      errorMessage,
    ];
  });

  // Create TSV content (Excel-friendly)
  const tsvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');

  // Download Excel file
  downloadFile(
    tsvContent,
    `${filename}.xls`,
    'application/vnd.ms-excel;charset=utf-8;'
  );
}

/**
 * Export provider summary to CSV
 * @param providerStats - Provider statistics
 * @param filename - Output filename (without extension)
 */
export async function exportProviderSummaryToCSV(
  providerStats: any[],
  filename: string
): Promise<void> {
  if (!providerStats || providerStats.length === 0) {
    throw new Error('No data to export');
  }

  // Define headers
  const headers = [
    'Provider',
    'Total Calls',
    'Successful Calls',
    'Failed Calls',
    'Success Rate (%)',
    'Total Cost ($)',
    'Avg Cost Per Call ($)',
    'Avg Response Time (ms)',
  ];

  // Convert data to CSV rows
  const rows = providerStats.map((stats) => {
    return [
      stats.providerName,
      stats.totalCalls,
      stats.successfulCalls,
      stats.failedCalls,
      stats.successRate.toFixed(2),
      stats.totalCost.toFixed(6),
      stats.avgCostPerCall.toFixed(6),
      stats.avgResponseTime,
    ];
  });

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // Download file
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export cost analysis to CSV
 * @param data - Usage logs with cost data
 * @param filename - Output filename (without extension)
 */
export async function exportCostAnalysisToCSV(data: any[], filename: string): Promise<void> {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Group by provider and date
  const grouped = data.reduce((acc, log) => {
    const date = new Date(log.created_at).toISOString().split('T')[0];
    const provider = log.provider_name || log.provider_id;
    const key = `${provider}-${date}`;

    if (!acc[key]) {
      acc[key] = {
        provider,
        date,
        calls: 0,
        cost: 0,
      };
    }

    acc[key].calls++;
    acc[key].cost += log.cost || 0;
    return acc;
  }, {} as Record<string, any>);

  // Define headers
  const headers = ['Date', 'Provider', 'API Calls', 'Total Cost ($)', 'Cost Per Call ($)'];

  // Convert to rows
  const rows = Object.values(grouped)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .map((item: any) => {
      return [
        item.date,
        item.provider,
        item.calls,
        item.cost.toFixed(6),
        (item.cost / item.calls).toFixed(6),
      ];
    });

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // Download file
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Helper function to trigger file download
 * @param content - File content
 * @param filename - Filename with extension
 * @param mimeType - MIME type of the file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate CSV content for projects list and trigger download
 */
export function generateProjectsCSV(
  projects: { name: string; slug: string; start_date: string | null; end_date: string | null; budget: number | null; client_name?: string; status_name?: string; owner_name?: string }[],
  filename = "projects"
): void {
  const headers = ["Name", "Slug", "Status", "Client", "Owner", "Start", "End", "Budget"];
  const rows = projects.map((p) => [
    p.name,
    p.slug,
    p.status_name ?? "",
    p.client_name ?? "",
    p.owner_name ?? "",
    p.start_date ? new Date(p.start_date).toISOString().split("T")[0] : "",
    p.end_date ? new Date(p.end_date).toISOString().split("T")[0] : "",
    p.budget != null ? String(p.budget) : "",
  ]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date range for export filename
 * @param dateRange - Date range identifier
 */
export function formatDateRangeForFilename(dateRange: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  switch (dateRange) {
    case '7d':
      return `last-7-days-${dateStr}`;
    case '30d':
      return `last-30-days-${dateStr}`;
    case '90d':
      return `last-90-days-${dateStr}`;
    case 'all':
      return `all-time-${dateStr}`;
    default:
      return dateStr;
  }
}
