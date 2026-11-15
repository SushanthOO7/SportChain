/** Matching three-quarter product and volcanic scene, on independent layers. */
export function FootwearScene() {
  return (
    <div className="footwear-scene" aria-hidden="true">
      <img
        className="scene-volcano-background"
        src="/images/hero-mountain-v4.webp"
        alt=""
        width="1536"
        height="1024"
      />
      <img
        className="scene-shoe scene-floating-shoe"
        src="/images/hero-angled-shoe-v4.webp"
        alt=""
        width="1536"
        height="1024"
        fetchPriority="high"
      />
    </div>
  );
}
