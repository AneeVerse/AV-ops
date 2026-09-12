"use client";

import {
  Alert,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Descriptions,
  Form,
  Grid,
  Input,
  InputNumber,
  Layout,
  Menu,
  Progress,
  Result,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message as antdMessage,
  theme,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  ReloadOutlined,

} from "@ant-design/icons";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Sider, Content } = Layout;

const progressSteps = [
  { title: "Upload PDF", description: "Send file to workflow" },
  { title: "Extract content", description: "Read all PDF pages" },
  { title: "Plan slides", description: "Create AI deck structure" },
  { title: "Generate image", description: "Create slide 1 hero image" },
  { title: "Build PPTX", description: "Replace approved placeholders" },
  { title: "Upload files", description: "Save PPTX and artifacts" },
];

const timedStepThresholds = [0, 2, 8, 30, 60, 100];

type GenerationState = "idle" | "processing" | "success" | "error";
type ActiveView = "generator" | "history";

type PdfToPptResponse = {
  success: boolean;
  run_id: string;
  original_file_name: string;
  provider: string;
  image_provider: string | null;
  pdf_pages: number;
  text_chars: number;
  chunks: number;
  slide_count: number;
  validation_valid: boolean;
  validation_issues: number;
  final_ppt_drive_id: string;
  final_ppt_link: string;
  final_ppt_file: string;
  source_pdf_link?: string;
  extracted_text_link?: string;
  build_payload_link?: string;
  generated_images_manifest_link?: string;
  generated_image_links?: string[];
  validation_report_link?: string;
  run_summary_link?: string;
  artifacts?: Record<string, unknown>;
};

function formatBytes(bytes?: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatElapsedTime(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function getPptxDownloadUrl(result: PdfToPptResponse) {
  if (!result.final_ppt_drive_id) return result.final_ppt_link;
  return `https://drive.google.com/uc?export=download&id=${result.final_ppt_drive_id}`;
}

function nameFromFile(file?: UploadFile) {
  if (!file?.name) return "";
  return file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

function artifactItems(result: PdfToPptResponse) {
  return [
    { key: "source", label: "Source PDF", href: result.source_pdf_link, icon: <FilePdfOutlined /> },
    { key: "text", label: "Extracted text", href: result.extracted_text_link, icon: <FilePdfOutlined /> },
    { key: "payload", label: "Build payload", href: result.build_payload_link, icon: <AppstoreOutlined /> },
    { key: "manifest", label: "Image manifest", href: result.generated_images_manifest_link, icon: <FileImageOutlined /> },
    { key: "validation", label: "Validation report", href: result.validation_report_link, icon: <CheckCircleOutlined /> },
    { key: "summary", label: "Run summary", href: result.run_summary_link, icon: <AppstoreOutlined /> },
  ].filter((item) => item.href);
}

export default function Home() {
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [state, setState] = useState<GenerationState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<PdfToPptResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [pageReady, setPageReady] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("generator");
  const [history, setHistory] = useState<PdfToPptResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const selectedFile = fileList[0];
  const activeStep = useMemo(() => {
    if (state === "success") return progressSteps.length;
    if (state === "idle") return 0;
    const index = timedStepThresholds.findLastIndex((threshold) => elapsed >= threshold);
    return Math.max(0, Math.min(index, progressSteps.length - 1));
  }, [elapsed, state]);

  const percent = state === "success" ? 100 : state === "idle" ? 0 : Math.min(95, 8 + activeStep * 15 + Math.min(12, elapsed / 8));

  useEffect(() => {
    let cancelled = false;

    async function waitForPageReady() {
      const minDelay = new Promise((resolve) => window.setTimeout(resolve, 1200));
      const windowLoaded = document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
      const fontsReady = "fonts" in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
      const logoReady = new Promise((resolve) => {
        const img = new window.Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = "/brand/content-beta-logo.jpg";
      });

      await Promise.all([minDelay, windowLoaded, fontsReady, logoReady]);
      if (!cancelled) setPageReady(true);
    }

    waitForPageReady();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "processing") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state === "success" && result) {
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }, [state, result]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const payload = await response.json();
      setHistory(Array.isArray(payload.history) ? payload.history : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const uploadProps: UploadProps = {
    accept: "application/pdf,.pdf",
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        antdMessage.error("Only PDF files are supported.");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      const currentName = form.getFieldValue("projectName");
      if (!currentName) form.setFieldValue("projectName", nameFromFile(file));
      return false;
    },
    onRemove: () => {
      setFileList([]);
      return true;
    },
    disabled: state === "processing",
  };

  async function handleGenerate(values: { projectName: string; slideCount: number }) {
    const file = (selectedFile?.originFileObj || selectedFile) as File | undefined;
    if (!file) {
      antdMessage.error("Upload a PDF first.");
      return;
    }

    setState("processing");
    setElapsed(0);
    setResult(null);
    setError("");

    try {
      const body = new FormData();
      body.append("pdf_file", file, file.name);
      body.append("project_name", values.projectName.trim());
      body.append("target_slide_count", String(values.slideCount || 10));

      const response = await fetch("/api/generate", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "PPT generation failed.");
      }

      setResult(payload as PdfToPptResponse);
      setState("success");
      antdMessage.success("PPTX generated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PPT generation failed.";
      setError(msg);
      setState("error");
      antdMessage.error(msg);
    }
  }

  function resetFlow() {
    setState("idle");
    setElapsed(0);
    setResult(null);
    setError("");
    setFileList([]);
    form.resetFields();
    form.setFieldValue("slideCount", 10);
  }

  async function copyLink(link?: string) {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    antdMessage.success("Link copied.");
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#355cff",
          borderRadius: 16,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        },
        components: {
          Card: { borderRadiusLG: 24 },
          Button: { borderRadius: 14 },
        },
      }}
    >
      {!pageReady && (
        <div className="startup-preloader" aria-label="Loading PDF to PPT Studio">
          <div className="startup-preloader-card">
            <div className="startup-logo-ring">
              <Image src="/brand/content-beta-logo.jpg" alt="Content Beta" width={92} height={92} className="startup-logo" priority />
            </div>
            <div className="startup-copy">
              <Text className="startup-eyebrow">Content Beta</Text>
              <Title level={3} className="startup-title">Loading PDF to PPT Studio</Title>
              <Text className="startup-subtitle">Preparing layout, assets, and workspace...</Text>
            </div>
          </div>
        </div>
      )}
      <Layout hasSider className={`app-shell ${pageReady ? "app-shell-ready" : "app-shell-booting"}`}>
        <Sider className="sidebar" width={264} style={{ overflow: "auto", height: "100vh", position: "fixed", insetInlineStart: 0, top: 0, bottom: 0, scrollbarWidth: "thin", scrollbarGutter: "stable", background: "#0b1220", padding: "18px 14px", zIndex: 1000 }} aria-label="Main navigation">
          <div className="brand-lockup">
            <Image src="/brand/content-beta-logo.jpg" alt="Content Beta" width={42} height={42} className="brand-logo" priority />
            <div>
              <Text className="brand-title">Content Beta</Text>
              <Text className="brand-subtitle">PDF to PPT Studio</Text>
            </div>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeView === "generator" ? "pdf-to-ppt" : "history"]}
            onClick={({ key }) => {
              if (key === "history") {
                setActiveView("history");
                loadHistory();
              } else {
                setActiveView("generator");
              }
            }}
            items={[
              { key: "pdf-to-ppt", icon: <FilePptOutlined />, label: "PDF to PPT" },
              { key: "history", icon: <HistoryOutlined />, label: "History" },
            ]}
          />
        </Sider>

        <Layout style={{ marginInlineStart: 264, minHeight: "100vh", background: "#f5f7fb" }}>
          <Content className="content-area">
            {activeView === "generator" ? (
            <>
            <section className="intro-grid">
              <Card className="hero-card" bordered={false}>
                <Space direction="vertical" size={12}>
                  <Tag color="blue">Production workflow</Tag>
                  <Title className="hero-title">Generate editable PowerPoint decks from PDFs.</Title>
                  <Paragraph className="hero-copy">
                    Upload a source PDF. The system extracts all pages, plans the presentation, generates the slide 1 hero image, builds an editable PPTX, and stores every artifact in Drive.
                  </Paragraph>
                </Space>
              </Card>
            </section>

            <section className="work-grid">
              <Card title="Create presentation" className="panel-card">
                <Form form={form} layout="vertical" initialValues={{ slideCount: 10 }} onFinish={handleGenerate} disabled={state === "processing"}>
                  <Form.Item label="Source PDF" required>
                    <Dragger {...uploadProps} className="upload-dragger">
                      <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
                      <p className="ant-upload-text">Drop your PDF here or click to browse</p>
                      <p className="ant-upload-hint">PDF only. Large files are supported, but may take a few minutes.</p>
                    </Dragger>
                    {selectedFile && (
                      <Alert
                        className="file-alert"
                        type="info"
                        showIcon
                        message={selectedFile.name}
                        description={`Size: ${formatBytes(selectedFile.size)} · Ready for generation`}
                      />
                    )}
                  </Form.Item>

                  <Form.Item name="projectName" label="Project name" rules={[{ required: true, message: "Project name is required" }]}>
                    <Input size="large" placeholder="Truckstop Partner Playbook" />
                  </Form.Item>

                  <Form.Item name="slideCount" label="Slide count" rules={[{ required: true, message: "Slide count is required" }]}>
                    <InputNumber size="large" min={3} max={30} className="full-width" />
                  </Form.Item>

                  <Space wrap>
                    <Button type="primary" htmlType="submit" size="large" icon={<PlayCircleOutlined />} loading={state === "processing"} disabled={!selectedFile}>
                      {state === "processing" ? "Generating PPTX" : "Generate PPTX"}
                    </Button>
                    <Button size="large" icon={<ReloadOutlined />} onClick={resetFlow} disabled={state === "processing"}>
                      Reset
                    </Button>
                  </Space>
                </Form>
              </Card>

              <Card title="Generation pipeline" className="panel-card">
                <Space direction="vertical" size={20} className="full-width">
                  {state === "processing" && (
                    <div className="inline-preloader">
                      <Image src="/brand/content-beta-logo.jpg" alt="Content Beta" width={54} height={54} className="inline-preloader-logo" />
                      <div>
                        <Text strong>Content Beta is generating your deck</Text>
                        <br />
                        <Text type="secondary">AI planning, image generation, and PPTX build are running.</Text>
                      </div>
                    </div>
                  )}
                  <Progress percent={Math.round(percent)} status={state === "error" ? "exception" : state === "success" ? "success" : "active"} />
                  <Steps
                    direction={screens.lg ? "vertical" : "horizontal"}
                    current={state === "success" ? progressSteps.length : activeStep}
                    status={state === "error" ? "error" : "process"}
                    items={progressSteps.map((step, index) => ({
                      title: step.title,
                      description: screens.lg ? step.description : undefined,
                      status: state === "success" ? "finish" : state === "error" && index === activeStep ? "error" : index < activeStep ? "finish" : index === activeStep && state === "processing" ? "process" : "wait",
                    }))}
                  />
                  <Alert
                    type={state === "processing" ? "warning" : "info"}
                    showIcon
                    message={state === "processing" ? "Generation is running" : "Ready when your PDF is uploaded"}
                    description={state === "processing" ? `Elapsed: ${formatElapsedTime(elapsed)}. Keep this tab open until the PPTX link appears.` : "The current backend is synchronous, so progress is estimated until the workflow returns."}
                  />
                </Space>
              </Card>
            </section>

            {error && (
              <Alert className="result-block" type="error" showIcon message="Generation failed" description={error} action={<Button onClick={() => setState("idle")}>Try again</Button>} />
            )}

            {result && (
              <div ref={resultRef} className="result-anchor">
              <Result
                className="result-card"
                status="success"
                icon={<CheckCircleOutlined />}
                title="Your PPTX is ready"
                subTitle={`Run ${result.run_id} generated ${result.slide_count} slides from ${result.pdf_pages} PDF pages.`}
                extra={[
                  <Button key="open" type="primary" size="large" href={result.final_ppt_link} target="_blank" icon={<FilePptOutlined />}>
                    Open PPTX
                  </Button>,
                  <Button key="download" size="large" href={getPptxDownloadUrl(result)} target="_blank" icon={<CloudUploadOutlined />}>
                    Download PPTX
                  </Button>,
                  <Button key="copy" size="large" onClick={() => copyLink(result.final_ppt_link)} icon={<CopyOutlined />}>
                    Copy link
                  </Button>,
                  <Button key="new" size="large" onClick={resetFlow}>New generation</Button>,
                ]}
              >
                <Card bordered={false} className="result-summary">
                  <Descriptions bordered column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                    <Descriptions.Item label="Planner">{result.provider}</Descriptions.Item>
                    <Descriptions.Item label="Image provider">{result.image_provider || "None"}</Descriptions.Item>
                    <Descriptions.Item label="Text chars">{result.text_chars?.toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="Validation">{result.validation_valid ? <Tag color="green">Passed</Tag> : <Tag color="red">Failed</Tag>}</Descriptions.Item>
                  </Descriptions>
                  <Collapse
                    className="artifact-collapse"
                    items={[
                      {
                        key: "artifacts",
                        label: "Advanced artifact links",
                        children: (
                          <div className="artifact-grid">
                            {artifactItems(result).map((item) => (
                              <Button key={item.key} href={item.href} target="_blank" icon={item.icon}>
                                {item.label}
                              </Button>
                            ))}
                            {(result.generated_image_links || []).map((href, index) => (
                              <Button key={href} href={href} target="_blank" icon={<FileImageOutlined />}>
                                Generated image {index + 1}
                              </Button>
                            ))}
                            <Button onClick={() => copyLink(result.final_ppt_link)} icon={<LinkOutlined />}>
                              Copy final PPTX link
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Result>
              </div>
            )}
            </>
            ) : (
              <Card className="panel-card" title="Generation history">
                <Table
                  loading={historyLoading}
                  rowKey={(record) => record.run_id || record.final_ppt_drive_id || record.final_ppt_link}
                  dataSource={history}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Project/File", dataIndex: "original_file_name", render: (value) => value || "Generated deck" },
                    { title: "Slides", dataIndex: "slide_count", width: 90 },
                    { title: "Pages", dataIndex: "pdf_pages", width: 90 },
                    { title: "AI", dataIndex: "provider", width: 130 },
                    { title: "Image", dataIndex: "image_provider", width: 120, render: (value) => value || "-" },
                    {
                      title: "PPTX",
                      width: 210,
                      render: (_, record) => (
                        <Space>
                          <Button size="small" href={record.final_ppt_link} target="_blank">Open</Button>
                          <Button size="small" href={getPptxDownloadUrl(record)} target="_blank">Download</Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
