import ReportExport from "@/components/ReportExport";
import Sidebar from "@/components/Sidebar";
import { fetchAirQualityReportRecords } from "@/lib/air-quality/server";

export default async function ReportsPage() {
  const observedRecords = await fetchAirQualityReportRecords();

  return (
    <main className="aq-reports-page relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="mx-auto w-full max-w-[110rem] px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pl-[16.75rem] lg:pt-8">
        <ReportExport observedRecords={observedRecords} />
      </div>
    </main>
  );
}
