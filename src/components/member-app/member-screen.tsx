interface MemberScreenProps {
  /** The mono label above the title, such as "01 · HOME". */
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}

/** One Member App screen inside the shell: its label and title, then its body, as the main landmark. */
export function MemberScreen({ eyebrow, title, children }: MemberScreenProps) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-4 px-4 pt-6 pb-10 wide:px-10 wide:pt-10"
    >
      <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue">{eyebrow}</p>
      <h1 className="text-[clamp(28px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-0.025em]">
        {title}
      </h1>
      {children}
    </main>
  );
}
