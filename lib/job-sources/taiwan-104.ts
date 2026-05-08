import axios from "axios";
import type { Job } from "@/lib/types";
import { hashUrl } from "@/lib/utils";

interface Job104 {
  jobNo: string;
  jobName: string;
  custName: string;
  jobAddrNoDesc: string;
  jobDetail: {
    jobCategory: { description: string }[];
    salary: string;
    salaryLow: number;
    salaryHigh: number;
    appearDate: string;
    workType: string;
    jobDescription?: string;
  };
  link: { job: string };
  tags: string[];
  remoteWork?: number; // 1 = remote available
}

interface SearchResponse {
  data: { list: Job104[] };
}

export async function fetch104Jobs(
  keywords: string = "product manager",
  area: string = "6001001000" // 台北市
): Promise<Job[]> {
  try {
    const { data } = await axios.get<SearchResponse>(
      "https://www.104.com.tw/jobs/search/list",
      {
        params: {
          ro: 0,
          kwop: 7,
          keyword: keywords,
          order: 15,
          asc: 0,
          page: 1,
          mode: "s",
          jobsource: "2018indexpoc",
          langFlag: 0,
          langStatus: 0,
          area,
        },
        headers: {
          Referer: "https://www.104.com.tw/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
        timeout: 15_000,
      }
    );

    return (data?.data?.list ?? []).map((j): Job => {
      const sourceUrl = j.link?.job
        ? `https:${j.link.job}`.replace(/\/\/job\//, "https://www.104.com.tw/job/")
        : `https://www.104.com.tw/job/${j.jobNo}`;

      const remote = j.remoteWork === 1 ? "remote" : "onsite";

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      if (j.jobDetail?.salaryLow && j.jobDetail.salaryLow > 0) {
        salaryMin = j.jobDetail.salaryLow;
        salaryMax = j.jobDetail.salaryHigh || j.jobDetail.salaryLow;
      }

      return {
        id: `104_${j.jobNo}`,
        externalId: `104_${j.jobNo}`,
        title: j.jobName,
        company: j.custName,
        country: "TW",
        city: j.jobAddrNoDesc || "台灣",
        remote,
        type: j.jobDetail?.workType || "Full-time",
        salaryMin,
        salaryMax,
        ccy: "TWD",
        yearsMin: null,
        yearsMax: null,
        industry: "tech.saas",
        skills: (j.tags ?? []).slice(0, 6),
        description: j.jobDetail?.jobDescription ?? j.jobName,
        source: "104",
        sourceUrl,
        sourceHash: hashUrl(sourceUrl),
        postedAt: j.jobDetail?.appearDate
          ? new Date(j.jobDetail.appearDate).toISOString()
          : new Date().toISOString(),
        crawledAt: new Date().toISOString(),
        score: null,
        matchReasons: [],
      };
    });
  } catch {
    return [];
  }
}
