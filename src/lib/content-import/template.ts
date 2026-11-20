import { zipSync } from "fflate";

import { CARD_IMPORT_COLUMNS } from "./cards";
import { QUIZ_IMPORT_COLUMNS } from "./quizzes";

// ─────────────────────────────────────────────────────────────────────────────
// The import templates (Phase 3, tickets 06 and 09; story 124): for cards, a
// CSV with the header row and two example cards, one with maths and a back
// image; for quizzes, one with two example questions, one with a figure; and
// a zip holding the example image both use, so importing either unchanged
// succeeds. The import screen offers the kind's template and the zip for
// download.
// ─────────────────────────────────────────────────────────────────────────────

export const CARD_TEMPLATE_CSV_FILENAME = "card-import-template.csv";
export const QUIZ_TEMPLATE_CSV_FILENAME = "quiz-import-template.csv";
export const EXAMPLE_ZIP_FILENAME = "import-example-images.zip";

/** The example card's back image and the example question's figure, as the templates name it. */
export const EXAMPLE_IMAGE = "simple-curve.png";

/** A 320 × 180 PNG of a simple curve (PC, PT and its radius), base64. */
const EXAMPLE_IMAGE_PNG = [
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAMAAADSOgUjAAACx1BMVEX28efa19H07+VGTlr18OZMU2AXIjUOGi4AWq",
  "X/iB8aJTiam53V08yKjZAnMUKpqqkPGy+eoKEUHzKvr64jb688RVPn49stN0eStMzs6N8THjLu6uGRk5b/jSnX1M7p",
  "5dzm4tpETFjf3NXw7ONWXWh6foUbJjkpM0QQHDASHjH50qzp5d3Y1c/h3db50Knt6eCOkZURHTBbYWw1Pkykv9Hx7e",
  "OhoqTHxcFBSVdqcHjq5t3BwLzy7eQqNEQ+R1T9o1PCbCO4uLXT0czFxMBZYGqxsbD50ar9olH9olAcJzlzeH9LUl/O",
  "y8cWITS7u7gYIzaQkpZASFbt6eFCSlhJUF0VIDNIT1zPzMigoqNscXlFTVne29R4fIJjaXHGxMHz7uX7u4CPkpVDS1",
  "k2QE6/vry+vbs3QFBQWGPW1M29vLqChYr0gyCkpaWbnJ7j39hlanNWOymMUyb/jCjMysSVl5lUW2YjLj90eX8uN0jd",
  "2tMsNkb7uX37un/g3NWWmJpcYmyEiI2zs7GjpKUiLT7h5OHm5+NCgreDh4xfZW+mp6eXmZv2hSJxdn2ysrE6Q1EyO0",
  "q5ubZtcnqJjJAhLD21tLNSWWQoMkP9olLFbybEw79IUFxYX2mqq6orNUUgKzxTWmXv6+IfKjz/jiqsrK28u7no5Nxh",
  "Z3AvOEkmMEEkL0AnMUHNy8Z7f4VkaXI5QlDygiD50qs9RlTDbSO3t7TU0sx/gojzgh9+gYc4QVGurq3b2NF2eoByd3",
  "6Ii491eYA0PUyrq6u2tbSBhIl5fYOZmp3lv5v5iCR3e4HPzcm0s7LNy8Wtra1Xj73d2tSio6VOVWBKUV45fbTuyKPD",
  "bCKwxtSeu9Alca4VZ6vA0Njn6OPz7+bD0tkvd7HI1dtmmcCNsMsncq84fbSivtAxeLKIrcp9p8cNYant6+WowdILYK",
  "gQZKmrq6xgZnBn9cCTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFT0lEQVR42u2d91tTVxjHD5XkJNqSCCYxIQSCsqqU",
  "WZCiCIIiuK2zddQ96t5abW2r1m7t0O699957713t3rv9I3rOTa5CpQ/cN95wc/L9/JAnufkpn+d73/fck5s3jAEAAA",
  "AAAAAAAAAAAAAAAAAAAAAAAACSm9TlKyAhBlJsvD8s0OPXqyfn3AUR9PhJfLOhgh4/znscCxcxxM9+3DFwgfghfogf",
  "4gcQP8QP8UP8AOKH+CF+hnE4ED+1BVq9+lldoOWrn7UFJkDztbTARGi+FhaItR/Wfogf4of4AcXjZ70unGDxs5zARK",
  "t+FhOYeNXPWgITsPnqAj+rrKz84+uvED+qwD4/7Nr142/ffIn4EenTVzzs+Ot7xC8WgeznXxE/qsBfdu7c8dOf3yJ+",
  "VIEOyXeIXyyn8O+Vji8QP2oX1mrgwc8Rv5gEHuiL+MUk8OP3EL9EupRTYd+vOwUqse3cfQKx7Yz4ofohfogfSPb4xb",
  "0Lqxa/eAtUrvrFV6CC1S+uAlVsvnEUqGbzjZ9ArP0Qv+7hhJFr1jS/jvhROcOpsRrxI+bPGWUV4kdipC6w3pai5Ac0",
  "uwtn6QLfUDR+cRN4C4NACs26wKEQSGKELvB4CCSxZHXE32kMAkkXIHV8Vf2FWUOj+RvucrnOzmUlrgjDsErpjGVi+e",
  "yuPfQyrcI2yjfmnG0ej8e9yeP5AII64fZ7hMCzDr9O6y0ezjtXPk3PgJ7OWSn8TV78H4Fj3ZkQ2DX2uIXA7ay9wNxy",
  "DxLYNfxbhL+F/doKFAfKPKNVEmhmF94rdBVVtz2SdqbXmxl5CoGdUlsoBN7X7pBWAyGwa2RvEv4unQiBVJqEv8IFDA",
  "KJjJdb0K3qd0qzBDamC391N2EpQsR7vfDXMhAiqHsI/eU18K0QQeUVWQBnwAOVZfISblA/iCDyaED4u3xzcnxYE7rw",
  "1Bbhb0wtg0AapxbIFfRLDAJpDHhKNpA5DAJp+KdIf9MZBBL9XSP93TgbAmlkD5L+Ti7BSiQmfwNgguhvgvQ3F/6o65",
  "dLpL9TToIJGqPl+o+H4Y9IQ35y5u9odeHl8vqXr/czCKSQulS7Cb9mMINACl65f8rLgslYuo6GwGqf9DfuaQaBpNM3",
  "KL8/4nfPYhBIP335hGewECExf4jU537hRKigUJJXJv3l45+6abysxY8/HIIKCjkrNX3uZ3H6kprv+Rs0f3feltweqF",
  "346h6avsIaP4NA4zxW7tb8zWtM+jORIjAnb7KmL5CHmw8IAlc8rm1ccX4tfmhEEJjynD2ir24J5BkXeO/Mooi+gmmp",
  "cGeUwRmLIq2D3zAHxc8ww5YWROzxIUE/dBgk02WLho/Pm4YLD6OrlqqmcVF7PDwctc8YA8dPKtLt5U+vhhAjXTj3ut",
  "aFujzunlI1EbrYEXOtHI7mER1tFUx9baaPH2bfk4thi3U018rhcDq3tlushBqCNeGebeTxirz5qHz/N9dKCnR+UhwK",
  "zbq492Ub7xj1YoC3o2hSUImfy3Az+FQXWN/x++lzX83wKhIWUwSergt84sj3br7y+QWZCp1tpgnUeLDt0TTbRReMLV",
  "atXJki8BFd4FV3+XwPLLp/RmnVFWtxeyTDXKu4sVXxuVbm89D+rENzrQAAAAAAgOpEJ5kKNpe+WboWQowSnWTK2N/2",
  "8Mby9HUwYlRgdJJpir1UPHk7gAFDFIFikun2Cu3luregxLhAOcl09z9wQRMYnWRqa4ULmsDoJNPdkQnP774DJYQaKO",
  "jVki0ec+wNUEITWLKlqZjlrA/jn3qIAlnoI74h8OE2GKFT3Pg+JAAAAAAAWIN/ASbR0eTuxrGiAAAAAElFTkSuQmCC",
].join("");

/** Pure: one CSV cell, quoted when it holds a comma, a quote or a line break. */
const cell = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

const CARD_ROWS: Record<(typeof CARD_IMPORT_COLUMNS)[number], string>[] = [
  {
    topic: "Simple Curves",
    front: "Degree of curve (arc basis)",
    back: "$D = \\dfrac{1145.916}{R}$",
    note: "R is the radius in metres. A dollar sign is written \\$, as in \\$5.",
    image: "",
  },
  {
    topic: "Simple Curves",
    front: "Length of curve",
    back: "$$L_c = \\dfrac{20I}{D}$$",
    note: "I is the central angle, D the degree of curve.",
    image: EXAMPLE_IMAGE,
  },
];

const QUIZ_ROWS: Record<(typeof QUIZ_IMPORT_COLUMNS)[number], string>[] = [
  {
    topic: "Simple Curves",
    question: "A simple curve has a radius of 200 m. What is its degree of curve (arc basis)?",
    "choice a": "$5.73^\\circ$",
    "choice b": "$2.86^\\circ$",
    "choice c": "$11.46^\\circ$",
    "choice d": "$1.15^\\circ$",
    "correct answer": "A",
    explanation:
      "$D = \\dfrac{1145.916}{R} = \\dfrac{1145.916}{200} \\approx 5.73^\\circ$. A dollar sign is written \\$.",
    figure: "",
  },
  {
    topic: "Simple Curves",
    question:
      "The curve in the figure has a central angle of 30° and a degree of curve of 2°. How long is it?",
    "choice a": "150 m",
    "choice b": "300 m",
    "choice c": "600 m",
    "choice d": "60 m",
    "correct answer": "B",
    explanation: "$$L_c = \\dfrac{20I}{D} = \\dfrac{20(30)}{2} = 300\\text{ m}$$",
    figure: EXAMPLE_IMAGE,
  },
];

/**
 * Pure: a template: UTF-8 with a byte order mark (so Excel reads it as
 * UTF-8), the header row in the template's column order, then the examples.
 */
function templateCsv<Column extends string>(
  columns: readonly Column[],
  rows: readonly Record<Column, string>[],
): string {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => cell(row[c])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** The card import's template. */
export const CARD_IMPORT_TEMPLATE_CSV = templateCsv(CARD_IMPORT_COLUMNS, CARD_ROWS);

/** The quiz import's template. */
export const QUIZ_IMPORT_TEMPLATE_CSV = templateCsv(QUIZ_IMPORT_COLUMNS, QUIZ_ROWS);

/** Pure: the zip of the templates' example image. */
export function importExampleZip(): Uint8Array {
  const png = Uint8Array.from(atob(EXAMPLE_IMAGE_PNG), (char) => char.charCodeAt(0));
  return zipSync({ [EXAMPLE_IMAGE]: png });
}
