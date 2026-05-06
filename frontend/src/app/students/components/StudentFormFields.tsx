"use client";

interface StatsChoices {
  status_choices: string[];
  grade_level_choices: string[];
  cohort_choices: string[];
  class_name_choices: string[];
}

interface Props {
  formData: Record<string, string>;
  fieldErrors: Record<string, string[]>;
  statsChoices: StatsChoices;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

function renderInput(
  id: string,
  label: string,
  formData: Record<string, string>,
  fieldErrors: Record<string, string[]>,
  onChange: Props["onChange"],
  type = "text",
  required = false,
  placeholder = " "
) {
  return (
    <div className="w-full md:w-1/2 mb-3">
      <div className="form-floating">
        <input
          type={type}
          className={`form-control ${fieldErrors[id] ? "is-invalid" : ""}`}
          id={id}
          name={id}
          value={formData[id] || ""}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
        />
        <label htmlFor={id} className={required ? "required-field" : ""}>
          {label}
        </label>
        {fieldErrors[id] && (
          <div className="invalid-feedback">
            {fieldErrors[id].map((err, i) => <div key={i}>{err}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentFormFields({ formData, fieldErrors, statsChoices, onChange }: Props) {
  return (
    <div className="flex flex-wrap">
      {renderInput("student_id", "学号", formData, fieldErrors, onChange, "text", true)}
      {renderInput("name", "姓名", formData, fieldErrors, onChange, "text", true)}

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className={`form-select ${fieldErrors.gender ? "is-invalid" : ""}`}
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={onChange}
          >
            <option value="">---------</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
          <label htmlFor="gender">性别</label>
          {fieldErrors.gender && (
            <div className="invalid-feedback">
              {fieldErrors.gender.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
        </div>
      </div>

      {renderInput("date_of_birth", "出生日期", formData, fieldErrors, onChange, "date")}

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className={`form-select ${fieldErrors.status ? "is-invalid" : ""}`}
            id="status"
            name="status"
            value={formData.status}
            onChange={onChange}
          >
            {statsChoices.status_choices.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <label htmlFor="status">在校状态</label>
          {fieldErrors.status && (
            <div className="invalid-feedback">
              {fieldErrors.status.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
        </div>
      </div>

      {renderInput("id_card_number", "身份证号码", formData, fieldErrors, onChange)}
      {renderInput("student_enrollment_number", "学籍号", formData, fieldErrors, onChange)}

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <textarea
            className={`form-control ${fieldErrors.home_address ? "is-invalid" : ""}`}
            id="home_address"
            name="home_address"
            value={formData.home_address}
            onChange={onChange}
            placeholder=" "
            style={{ height: "calc(3.5rem + 2px)" }}
          ></textarea>
          <label htmlFor="home_address">家庭地址</label>
          {fieldErrors.home_address && (
            <div className="invalid-feedback">
              {fieldErrors.home_address.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
        </div>
      </div>

      {renderInput("guardian_name", "监护人姓名", formData, fieldErrors, onChange)}
      {renderInput("guardian_contact_phone", "监护人联系电话", formData, fieldErrors, onChange)}
      {renderInput("entry_date", "入学日期", formData, fieldErrors, onChange, "date")}
      {renderInput("graduation_date", "毕业日期", formData, fieldErrors, onChange, "date")}

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className="form-select"
            id="section"
            name="section"
            value={formData.section}
            onChange={onChange}
            required
          >
            <option value="">请选择学段</option>
            <option value="初中">初中</option>
            <option value="高中">高中</option>
          </select>
          <label htmlFor="section" className="required-field">
            <i className="fas fa-layer-group mr-1"></i>学段
          </label>
        </div>
      </div>

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className="form-select"
            id="cohort_year"
            name="cohort_year"
            value={formData.cohort_year}
            onChange={onChange}
            required
          >
            <option value="">请选择入学年份</option>
            <option value="2023">2023级</option>
            <option value="2024">2024级</option>
            <option value="2025">2025级</option>
            <option value="2026">2026级</option>
            <option value="2027">2027级</option>
            <option value="2028">2028级</option>
            <option value="2029">2029级</option>
          </select>
          <label htmlFor="cohort_year" className="required-field">
            <i className="fas fa-calendar mr-1"></i>入学年份
          </label>
        </div>
      </div>

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className={`form-select ${fieldErrors.grade_level ? "is-invalid" : ""}`}
            id="grade_level"
            name="grade_level"
            value={formData.grade_level}
            onChange={onChange}
            required
          >
            <option value="">请选择年级</option>
            {statsChoices.grade_level_choices.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label htmlFor="grade_level" className="required-field">
            <i className="fas fa-graduation-cap mr-1"></i>当前年级
          </label>
          {fieldErrors.grade_level && (
            <div className="invalid-feedback">
              {fieldErrors.grade_level.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-1/2 mb-3">
        <div className="form-floating">
          <select
            className={`form-select ${fieldErrors.class_name ? "is-invalid" : ""}`}
            id="class_name"
            name="class_name"
            value={formData.class_name}
            onChange={onChange}
            required
          >
            <option value="">请选择班级</option>
            {statsChoices.class_name_choices.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label htmlFor="class_name" className="required-field">
            <i className="fas fa-users mr-1"></i>班级名称
          </label>
          {fieldErrors.class_name && (
            <div className="invalid-feedback">
              {fieldErrors.class_name.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
