export interface ATSAnalysis {
  id: string;
  date: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  scores: {
    overall: number;
    formatting: number;
    keywords: number;
    impact: number;
    structure: number;
    skills: number;
  };
  report: {
    strengths: string[];
    weaknesses: string[];
    missingKeywords: string[];
    formattingProblems: string[];
    improvements: string[];
  };
  rewrittenCV: string;
  latexCode: string;
  overleafInstructions: string;
  coverLetter?: string;
}
