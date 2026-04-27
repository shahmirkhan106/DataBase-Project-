from flask import Flask, render_template, request, redirect
import sqlite3

app = Flask(__name__)

# Database connection
def get_db():
    return sqlite3.connect("database.db")

# Home redirects to role selection
@app.route("/")
def home():
    return redirect("/select-role")

# Role selection
@app.route("/select-role", methods=["GET", "POST"])
def select_role():
    if request.method == "POST":
        role = request.form.get("role")
        if role == "student":
            return redirect("/student-dashboard")
        elif role == "teacher":
            return redirect("/teacher-dashboard")
        elif role == "admin":
            return redirect("/admin-dashboard")
        else:
            return redirect("/select-role")
    return render_template("index.html")

@app.route("/student-dashboard")
def student_dashboard():
    db = get_db()
    cur = db.cursor()
    # Get all courses for dropdowns
    cur.execute("SELECT * FROM Course")
    courses = cur.fetchall()
    # Get registered courses for student_id=1 (example for now)
    cur.execute("SELECT c.title FROM Course c JOIN Enrollment e ON c.course_id=e.course_id WHERE e.student_id=1")
    registered = cur.fetchall()
    db.close()
    return render_template("student_dashboard.html", courses=courses, registered=registered)

# Register for a course
@app.route("/register-course", methods=["POST"])
def register_course():
    student_id = 1  # Example, in real app use login system
    course_id = request.form.get("course_id")
    db = get_db()
    cur = db.cursor()
    cur.execute("INSERT INTO Enrollment (student_id, course_id) VALUES (?, ?)", (student_id, course_id))
    db.commit()
    db.close()
    return redirect("/student-dashboard")

# Drop a course
@app.route("/drop-course", methods=["POST"])
def drop_course():
    student_id = 1
    course_id = request.form.get("course_id")
    db = get_db()
    cur = db.cursor()
    cur.execute("DELETE FROM Enrollment WHERE student_id=? AND course_id=?", (student_id, course_id))
    db.commit()
    db.close()
    return redirect("/student-dashboard")

# View pre-reqs for selected course
@app.route("/prereqs", methods=["POST"])
def prereqs():
    course_id = request.form.get("course_id")
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT prereq_id FROM Prerequisite WHERE course_id=?", (course_id,))
    prereqs = cur.fetchall()
    db.close()
    return render_template("prereqs.html", prereqs=prereqs)


@app.route("/teacher-dashboard")
def teacher_dashboard():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM Course")
    courses = cur.fetchall()
    db.close()
    return render_template("teacher-dashboard.html", courses=courses)

@app.route("/select-teach-course", methods=["POST"])
def select_teach_course():
    course_id = request.form.get("course_id")
    # Store in database if you want teacher-course assignment
    return f"You selected to teach {course_id}"  # simple placeholder

@app.route("/admin-dashboard")
def admin_dashboard():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM Course")
    courses = cur.fetchall()
    db.close()
    return render_template("admin-dashboard.html", courses=courses)

@app.route("/add-course", methods=["POST"])
def add_course():
    course_id = request.form.get("course_id")
    title = request.form.get("title")
    db = get_db()
    cur = db.cursor()
    cur.execute("INSERT INTO Course (course_id, title) VALUES (?, ?)", (course_id, title))
    db.commit()
    db.close()
    return redirect("/admin-dashboard")

@app.route("/add-prereq", methods=["POST"])
def add_prereq():
    course_id = request.form.get("course_id")
    prereq_id = request.form.get("prereq_id")
    db = get_db()
    cur = db.cursor()
    cur.execute("INSERT INTO Prerequisite (course_id, prereq_id) VALUES (?, ?)", (course_id, prereq_id))
    db.commit()
    db.close()
    return redirect("/admin-dashboard")

@app.route("/generate-timetable")
def generate_timetable():
    # placeholder logic: assign courses to students automatically
    return "Timetable generated (placeholder)"

# Run app
if __name__ == "__main__":
    app.run(debug=True)

