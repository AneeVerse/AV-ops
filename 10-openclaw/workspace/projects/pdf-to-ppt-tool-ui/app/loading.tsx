import Image from "next/image";

export default function Loading() {
  return (
    <main className="brand-preloader-screen">
      <div className="brand-preloader-card">
        <div className="brand-preloader-logo-wrap">
          <Image
            src="/brand/content-beta-logo.jpg"
            alt="Content Beta"
            width={82}
            height={82}
            className="brand-preloader-logo"
            priority
          />
        </div>
        <div>
          <p className="brand-preloader-title">Loading PDF to PPT Studio</p>
          <p className="brand-preloader-copy">Preparing your workspace...</p>
        </div>
      </div>
    </main>
  );
}
