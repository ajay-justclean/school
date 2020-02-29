module.exports = (sequelize, DataTypes) => {
  const Students = sequelize.define('students', {
	code: DataTypes.STRING,
	name: DataTypes.STRING,
	image_logo: DataTypes.STRING,
	phone_ext: DataTypes.STRING,
	phone: DataTypes.STRING,
	email: DataTypes.STRING,
	status: DataTypes.ENUM('active', 'inactive'),
  }, {
    hooks: {
      beforeCount (options) {
        options.raw = true;
      }
    },
    tableName: 'students',
    paranoid: true,
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  return Students;
};
